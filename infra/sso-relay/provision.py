"""Create (or resume) the Corta SSO relay on AWS Asia Pacific (Thailand), ap-southeast-7.

One small EC2 instance with a fixed Elastic IP (a Thai IP), Caddy with an automatic Let's Encrypt certificate on
<ip-with-dashes>.sslip.io, forwarding only the two Thai Post SSO calls when the request carries the relay key.

    D:\\Installers\\awscli-venv\\Scripts\\python.exe infra\\sso-relay\\provision.py

Needs AWS credentials from `aws configure` (default profile, or AWS_PROFILE). Safe to run again: it picks up from
infra/sso-relay/local/state.json. Never prints secrets; the relay key stays in local/state.json and the clipboard.
"""
import hashlib
import hmac
import json
import os
import pathlib
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request

import boto3
import botocore.exceptions

REGION = "ap-southeast-7"
NAME = "corta-sso-relay"
CADDY_VERSION = "2.8.4"
TYPES = ["t4g.nano", "t3.nano", "t3.micro"]  # cheapest first; arm64 for t4g
HERE = pathlib.Path(__file__).resolve().parent
LOCAL = HERE / "local"
STATE = LOCAL / "state.json"
REPO = HERE.parent.parent
ENV_LOCAL = REPO / ".env.local"


def say(msg):
    print(msg, flush=True)


def load_state():
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}


def save_state(s):
    LOCAL.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(s, indent=1), encoding="utf-8")


def env_local():
    out = {}
    for line in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def tags(kind):
    return [{"ResourceType": kind, "Tags": [{"Key": "Name", "Value": NAME}, {"Key": "project", "Value": "corta"}]}]


def main():
    s = load_state()
    session = boto3.session.Session(region_name=REGION)
    try:
        # the global STS endpoint answers even before the Thailand region is enabled
        who = boto3.session.Session(region_name="us-east-1").client("sts").get_caller_identity()
    except botocore.exceptions.NoCredentialsError:
        sys.exit("No AWS credentials. Run: D:\\Installers\\awscli-venv\\Scripts\\aws.cmd configure")
    except botocore.exceptions.ClientError as e:
        sys.exit(f"AWS refused the credentials ({e.response['Error']['Code']}). Check the access key in aws configure.")
    say(f"AWS account {who['Account']}, region {REGION}")
    ec2 = session.client("ec2")
    try:
        ec2.describe_availability_zones()
    except botocore.exceptions.ClientError as e:
        sys.exit(f"Region {REGION} is not usable yet ({e.response['Error']['Code']}). Enable 'Asia Pacific (Thailand)' "
                 "in the AWS console: account menu > Account > AWS Regions, wait a few minutes, then run this again.")

    # instance type and image
    if "instance_type" not in s:
        offered = {o["InstanceType"] for o in ec2.describe_instance_type_offerings(
            LocationType="region", Filters=[{"Name": "instance-type", "Values": TYPES}])["InstanceTypeOfferings"]}
        pick = next((t for t in TYPES if t in offered), None)
        if not pick:
            sys.exit(f"None of {TYPES} is offered in {REGION}")
        s["instance_type"] = pick
        save_state(s)
    arch = "arm64" if s["instance_type"].startswith("t4g") else "x86_64"
    ami = session.client("ssm").get_parameter(
        Name=f"/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-{arch}")["Parameter"]["Value"]
    say(f"instance type {s['instance_type']}, image {ami}")

    # network: default VPC
    vpcs = ec2.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])["Vpcs"]
    vpc_id = vpcs[0]["VpcId"] if vpcs else ec2.create_default_vpc()["Vpc"]["VpcId"]

    # ssh key (for debugging only), saved next to the state, never committed
    if "key_name" not in s:
        k = ec2.create_key_pair(KeyName=NAME, KeyType="ed25519", KeyFormat="pem", TagSpecifications=tags("key-pair"))
        LOCAL.mkdir(exist_ok=True)
        (LOCAL / f"{NAME}.pem").write_text(k["KeyMaterial"], encoding="utf-8")
        s["key_name"] = NAME
        save_state(s)
        say("ssh key created (infra/sso-relay/local)")

    # firewall: 80 for the certificate challenge, 443 for the relay, 22 only from this PC's current IP
    if "sg_id" not in s:
        sg = ec2.create_security_group(GroupName=NAME, Description="Corta SSO relay", VpcId=vpc_id,
                                       TagSpecifications=tags("security-group"))["GroupId"]
        my_ip = urllib.request.urlopen("https://checkip.amazonaws.com", timeout=10).read().decode().strip()
        ec2.authorize_security_group_ingress(GroupId=sg, IpPermissions=[
            {"IpProtocol": "tcp", "FromPort": 80, "ToPort": 80, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]},
            {"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]},
            {"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, "IpRanges": [{"CidrIp": f"{my_ip}/32", "Description": "admin"}]},
        ])
        s["sg_id"] = sg
        save_state(s)
        say("firewall created")

    # the fixed IP
    if "allocation_id" not in s:
        a = ec2.allocate_address(Domain="vpc", TagSpecifications=tags("elastic-ip"))
        s.update(allocation_id=a["AllocationId"], ip=a["PublicIp"], host=a["PublicIp"].replace(".", "-") + ".sslip.io")
        save_state(s)
    say(f"fixed IP {s['ip']}  host {s['host']}")

    if "relay_key" not in s:
        s["relay_key"] = secrets.token_urlsafe(32)
        save_state(s)

    # the server
    if "instance_id" not in s:
        user_data = ((HERE / "user-data.sh").read_text(encoding="utf-8")
                     .replace("__CADDYFILE__", (HERE / "Caddyfile").read_text(encoding="utf-8").strip())
                     .replace("__CADDY_VERSION__", CADDY_VERSION)
                     .replace("__RELAY_HOST__", s["host"])
                     .replace("__RELAY_KEY__", s["relay_key"]))
        root = ec2.describe_images(ImageIds=[ami])["Images"][0]["RootDeviceName"]
        r = ec2.run_instances(
            ImageId=ami, InstanceType=s["instance_type"], KeyName=s["key_name"], SecurityGroupIds=[s["sg_id"]],
            MinCount=1, MaxCount=1, UserData=user_data,
            MetadataOptions={"HttpTokens": "required", "HttpEndpoint": "enabled"},
            BlockDeviceMappings=[{"DeviceName": root, "Ebs": {"VolumeSize": 8, "VolumeType": "gp3", "Encrypted": True,
                                                              "DeleteOnTermination": True}}],
            CreditSpecification={"CpuCredits": "standard"},  # never bill for burst CPU
            TagSpecifications=tags("instance") + tags("volume"))
        s["instance_id"] = r["Instances"][0]["InstanceId"]
        save_state(s)
        say(f"server {s['instance_id']} starting")
    ec2.get_waiter("instance_running").wait(InstanceIds=[s["instance_id"]])
    if not s.get("associated"):
        ec2.associate_address(AllocationId=s["allocation_id"], InstanceId=s["instance_id"])
        s["associated"] = True
        save_state(s)
    say("server running with the fixed IP; waiting for setup and the certificate (a few minutes)")

    # wait for https://host/health
    url = f"https://{s['host']}"
    for i in range(80):
        try:
            if urllib.request.urlopen(url + "/health", timeout=8).read().decode().strip() == "ok":
                say("relay is up with a valid certificate")
                break
        except Exception:
            pass
        time.sleep(10)
    else:
        sys.exit("relay did not come up within ~13 minutes. Most likely the certificate for the sslip.io name could "
                 "not be issued, or the setup script failed: check /var/log/corta-relay-setup.log over ssh "
                 f"(ssh -i infra/sso-relay/local/{NAME}.pem ec2-user@{s['ip']}).")

    # checks: without the key -> 404; with the key -> Thai Post itself answers
    def post(path, key, body):
        req = urllib.request.Request(url + path, data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "Accept": "application/json",
                                              "Accept-Language": "th", **({"X-Relay-Key": key} if key else {})})
        try:
            r = urllib.request.urlopen(req, timeout=20)
            return r.status, r.headers.get("X-Relay", ""), r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, e.headers.get("X-Relay", ""), e.read().decode("utf-8", "replace")

    env = env_local()
    handoff = secrets.token_hex(32)  # never issued, so Thai Post must refuse it with 500011
    challenge = hmac.new(env["THP_SSO_CLIENT_SECRET"].encode(), handoff.encode(), hashlib.sha256).hexdigest()
    body = {"clientId": env["THP_SSO_CLIENT_ID"], "challenge": challenge}
    st, relay, _ = post("/uat/ms-commons/v1/sso/oauth/token", None, body)
    say(f"check without the relay key: {st} {'refused by the relay (good)' if relay == 'refused' else 'NOT refused by the relay: check the Caddyfile'}")
    st, relay, text = post("/uat/ms-commons/v1/sso/oauth/token", s["relay_key"], body)
    code = ""
    try:
        code = str(json.loads(text)["error"]["code"])
    except Exception:
        pass
    if st == 401 and code == "500011":
        say("check through the relay: 401 500011 = Thai Post accepted the request from this IP. Ready.")
    elif relay == "refused":
        say("check through the relay: the RELAY refused it (its own 404), so the relay config is wrong, not Thai Post")
    elif st == 403 and not code:
        say(f"check through the relay: Thai Post's gateway blocks this IP (plain 403). Ask them to register {s['ip']}.")
    else:
        say(f"check through the relay: unexpected {st} {code or text[:60]!r}")

    # the two settings Vercel needs, to the clipboard (never printed); "\n" only, Windows adds no stray CR this way
    lines = f"THP_SSO_BASE_URL={url}/uat/ms-commons\nTHP_SSO_RELAY_KEY={s['relay_key']}"
    subprocess.run(["powershell", "-NoProfile", "-Command", "$input | Set-Clipboard"], input=lines, text=True, check=True)
    say("copied to clipboard for Vercel: THP_SSO_BASE_URL and THP_SSO_RELAY_KEY")
    say(f"IP to give Thai Post: {s['ip']}")


if __name__ == "__main__":
    main()
