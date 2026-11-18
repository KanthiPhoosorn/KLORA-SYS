"""Remove everything provision.py created, so nothing keeps billing: server, fixed IP, firewall, ssh key.

    D:\\Installers\\awscli-venv\\Scripts\\python.exe infra\\sso-relay\\teardown.py

The fixed IP is released, so a new relay gets a NEW IP that Thai Post would have to register again.
"""
import json
import pathlib
import sys

import boto3
import botocore.exceptions

REGION = "ap-southeast-7"
HERE = pathlib.Path(__file__).resolve().parent
LOCAL = HERE / "local"
STATE = LOCAL / "state.json"


def gone(fn, *a, **kw):
    try:
        fn(*a, **kw)
    except botocore.exceptions.ClientError as e:
        print(f"  (skipped: {e.response['Error']['Code']})")


def main():
    if not STATE.exists():
        sys.exit("nothing to remove (no local/state.json)")
    s = json.loads(STATE.read_text(encoding="utf-8"))
    ec2 = boto3.session.Session(region_name=REGION).client("ec2")
    if s.get("instance_id"):
        print(f"terminating {s['instance_id']}")
        gone(ec2.terminate_instances, InstanceIds=[s["instance_id"]])
        gone(ec2.get_waiter("instance_terminated").wait, InstanceIds=[s["instance_id"]])
    if s.get("allocation_id"):
        print(f"releasing fixed IP {s.get('ip')}")
        gone(ec2.release_address, AllocationId=s["allocation_id"])
    if s.get("sg_id"):
        print("deleting firewall")
        gone(ec2.delete_security_group, GroupId=s["sg_id"])
    if s.get("key_name"):
        print("deleting ssh key")
        gone(ec2.delete_key_pair, KeyName=s["key_name"])
        pem = LOCAL / f"{s['key_name']}.pem"
        if pem.exists():
            pem.unlink()
    STATE.rename(LOCAL / "state.removed.json")
    print("done: nothing of the relay is left on AWS")


if __name__ == "__main__":
    main()
