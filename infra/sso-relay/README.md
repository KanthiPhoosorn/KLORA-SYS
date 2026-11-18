# Corta SSO relay (fixed Thai IP)

Thai Post's SuperApp SSO API only accepts requests from Thai IP addresses, and Vercel has no Thai region and no
fixed outgoing IP on the Hobby plan. This relay is one small server in AWS Asia Pacific (Thailand), ap-southeast-7,
with a fixed Elastic IP. Corta's two SSO calls go through it; nothing else does.

- Caddy with an automatic Let's Encrypt certificate on `<ip-with-dashes>.sslip.io`.
- Forwards only `/uat|/prod` + `/ms-commons/v1/sso/oauth/token` and `/ms-commons/v1/sso/profile`.
- Refuses any request without the `X-Relay-Key` header (404) and strips it before forwarding.
- No access log (the profile call carries a member's bearer token). The client secret never reaches the relay:
  Corta computes the challenge on Vercel.

## One-time setup (Kanthi)
1. Create an AWS account at aws.amazon.com (email, card, phone check).
2. Enable the Thailand region: console, account menu (top right) > Account > AWS Regions >
   Asia Pacific (Thailand) > Enable. It takes a few minutes.
3. IAM > Users > Create user `corta-cli`, attach `AmazonEC2FullAccess` and `AmazonSSMReadOnlyAccess`.
   Open the user > Security credentials > Create access key > Command Line Interface.
4. In a terminal: `D:\Installers\awscli-venv\Scripts\aws.cmd configure` and paste the two keys,
   region `ap-southeast-7`, output `json`.

## Create, check, remove
```
D:\Installers\awscli-venv\Scripts\python.exe infra\sso-relay\provision.py   # create or resume, then test
D:\Installers\awscli-venv\Scripts\python.exe infra\sso-relay\teardown.py    # remove everything (stops billing)
```
`provision.py` ends by testing a call through the relay (a never-issued handoff must come back as 401 500011
from Thai Post), prints the IP to give Thai Post, and copies the two Vercel settings to the clipboard:
`THP_SSO_BASE_URL=https://<host>/uat/ms-commons` and `THP_SSO_RELAY_KEY`. Add both in Vercel (Production) and
redeploy. For PROD later, change the path to `/prod/ms-commons` and the client id and secret.

Local files (ids, relay key, ssh key) live in `infra/sso-relay/local/`, which git ignores.

`sslip.io` is a free third-party name service, fine for UAT. Before PROD, point a `corta.tech` subdomain
(for example `sso-relay.corta.tech`, an A record to the fixed IP) at the relay and use that host instead.
