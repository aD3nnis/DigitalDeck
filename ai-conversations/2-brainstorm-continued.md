## me
yes sketch out the Terraform structure for this lean version (single EC2 instance, security groups, the destroy/apply workflow)

---
## Claude
Here's a lean Terraform layout — one EC2 box, minimal security surface, and a workflow built around spinning it up only when you're playing.

**File structure**

```
terraform/
├── main.tf          # provider, EC2 instance, key pair
├── network.tf       # security group
├── variables.tf     # your IP, instance type, key name
├── outputs.tf       # public IP after apply
└── user-data.sh     # bootstrap script (installs Docker, pulls your compose file)
```

**Security group — keep it tight**

```hcl
resource "aws_security_group" "card_deck_sg" {
  name = "card-deck-app-sg"

  ingress {
    description = "SSH from you only"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  ingress {
    description = "App traffic (HTTP + WebSocket)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

The important detail: SSH restricted to your IP (`var.my_ip`, e.g. `"YOUR_IP/32"`), app port open to the world since your friends need to reach it. No other ports exposed — Postgres and Redis stay inside the Docker network, never hit the security group at all.

**The EC2 instance**

```hcl
resource "aws_instance" "card_deck_host" {
  ami                    = "ami-0..."  # Amazon Linux 2023, ARM
  instance_type          = "t4g.micro" # free tier eligible
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.card_deck_sg.id]
  user_data              = file("user-data.sh")

  tags = { Name = "card-deck-app" }
}
```

**`user-data.sh`** — runs once on boot, so a fresh `terraform apply` always comes up ready:

```bash
#!/bin/bash
yum install -y docker git
systemctl start docker
usermod -aG docker ec2-user
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
git clone https://github.com/you/card-deck-app.git /home/ec2-user/app
cd /home/ec2-user/app && docker-compose up -d
```

**The apply/destroy workflow**

```bash
# before game night
terraform apply -auto-approve
terraform output public_ip    # send this to your friends

# after game night
terraform destroy -auto-approve
```

Since `user_data` rebuilds the whole environment from your Git repo on every boot, `apply` after a `destroy` gives you back an identical, working instance — no manual setup, no drift. The tradeoff is a minute or two of boot time before the app's actually reachable, which is a fine price for paying $0 the rest of the week.

One thing worth deciding before you wire up DNS or share links with friends: do you want a static IP (an Elastic IP, ~$3.60/month *only while the instance is stopped*, free while it's attached and running) so the address doesn't change every time you re-apply? Otherwise you'll be re-sending a new IP to your group each session.

---
## me
I think id want a static IP? How I want it to work is similar to the jack box games where they just enter a code and join my session

---
## Claude
Good instinct — that Jackbox pattern (fixed address, short rotating code) actually solves two problems at once: it gives you a stable place to send people, and it means the *session* is the thing that's temporary, not your infrastructure's address.

**The static IP piece — split your Terraform into two layers**

This is the key adjustment to the destroy/apply workflow: if the Elastic IP lives in the same state as the EC2 instance, destroying the instance destroys the IP too, and you're back to sending a new address every time. So separate them:

```
terraform/
├── persistent/          # apply once, never destroy
│   ├── main.tf           # the Elastic IP allocation
│   └── outputs.tf        # the static IP itself
└── session/              # apply/destroy per game night
    ├── main.tf           # EC2 instance
    ├── network.tf         # security group
    └── main.tf            # aws_eip_association, referencing the persistent IP
```

```hcl
# persistent/main.tf — set this up once
resource "aws_eip" "card_deck_ip" {
  domain = "vpc"
}
```

```hcl
# session/main.tf — this cycles every game night
resource "aws_eip_association" "attach" {
  instance_id   = aws_instance.card_deck_host.id
  allocation_id = data.terraform_remote_state.persistent.outputs.eip_allocation_id
}
```

Now `terraform destroy` in the `session/` folder tears down the EC2 box but leaves the IP allocated and waiting. `terraform apply` next time spins up a fresh instance and re-attaches the same IP — same address every time, zero manual DNS-juggling. One cost note: an Elastic IP is free *while attached to a running instance*, but AWS charges a small hourly fee (~$3.60/month) for an IP that's allocated but *not* attached to anything — which is exactly the state it'll be in between game nights. That's a small, predictable cost for the convenience of a stable address; if you want to avoid even that, the alternative is re-sending a new IP each time, which defeats the point.

If you want to go a step further, a cheap domain (~$12/year) pointed at that IP means friends type something like `cards.yourname.dev` instead of memorizing an IP — closer to the Jackbox feel, and I'd guess you're already paying for at least one domain.

**The join-code piece — this is actually app logic, not infrastructure**

The IP gets people to your *website*. The code gets them into a *session*. That lives in Redis, independent of networking:

- When someone creates a session, the backend generates a short code (4-5 chars, alphanumeric, skip ambiguous ones like `0`/`O`/`1`/`I`) and stores `code:{code} → sessionId` in Redis with the same TTL as the session itself.
- The landing page is just a "enter code" field hitting `GET /api/sessions/resolve?code=ABCD`, which returns the `sessionId` the frontend then uses to open the WebSocket subscription and join.
- Codes recycle naturally once a session's TTL expires — no cleanup job needed.

So the full flow: friends go to your stable domain/IP → land on a simple "enter code" screen → you tell them the code verbally or over text → they're in the session. Exactly the Jackbox feel, built on infrastructure that costs you almost nothing to leave dormant.