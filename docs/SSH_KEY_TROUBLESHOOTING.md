# SSH Key Troubleshooting Guide

## Error: "Load key: error in libcrypto"

This error occurs when the SSH private key in GitHub Secrets is malformed or incorrectly formatted.

### Common Causes

1. **Extra whitespace or newlines** - Key was copied with extra spaces
2. **Missing header/footer** - BEGIN/END lines are incomplete
3. **Wrong key type** - Using public key instead of private key
4. **Line ending issues** - Windows CRLF instead of Unix LF
5. **Truncated key** - Key was partially copied

### Solution: Re-add the SSH Key

#### Step 1: Locate Your SSH Private Key

On your local machine or VPS, find the private key file:

```bash
# Common locations:
ls -la ~/.ssh/id_rsa
ls -la ~/.ssh/id_ed25519
ls -la ~/.ssh/deploy_key
```

#### Step 2: Validate the Key Format

Use our validation script:

```bash
bash deployment/scripts/validate-ssh-key.sh ~/.ssh/your_key_file
```

This will:
- Verify the key is valid
- Show the properly formatted key
- Check for common issues
- Provide the exact content to copy

#### Step 3: Copy the Key Correctly

**IMPORTANT:** Copy the ENTIRE key including:
- `-----BEGIN OPENSSH PRIVATE KEY-----` (or similar header)
- All the encoded key data
- `-----END OPENSSH PRIVATE KEY-----` (or similar footer)

**Example of correct format:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBqL9Xt5uKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKwAAAJgXyZ8XF8mf
FwAAAAtzc2gtZWQyNTUxOQAAACBqL9Xt5uKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKw
AAAEDKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKv
KvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvK
vKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKvKv
-----END OPENSSH PRIVATE KEY-----
```

#### Step 4: Update GitHub Secret

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Find **VPS_SSH_KEY** and click **Update** (or create if missing)
4. **Paste the entire key** - no extra spaces before or after
5. Click **Update secret**

#### Step 5: Verify Other Secrets

While you're there, verify these secrets are also set:

- **VPS_USER** - Your SSH username (e.g., `root`)
- **VPS_HOSTNAME** - Your VPS IP or hostname (e.g., `134.209.146.20`)
- **DISCORD_WEBHOOK_URL** - Discord webhook for notifications (optional)

### Alternative: Generate a New Deploy Key

If you don't have the original key or it's corrupted, generate a new one:

```bash
# Generate new ED25519 key (recommended)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""

# This creates:
# - deploy_key (private key - for GitHub Secret)
# - deploy_key.pub (public key - for VPS)
```

**Add public key to VPS:**

```bash
# Copy the public key
cat ~/.ssh/deploy_key.pub

# SSH into your VPS
ssh root@your-vps-ip

# Add the public key
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "paste-public-key-here" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**Add private key to GitHub:**

```bash
# Display the private key
cat ~/.ssh/deploy_key

# Copy the ENTIRE output and add to GitHub Secret VPS_SSH_KEY
```

### Testing the Connection

After updating the secret, test the deployment:

1. Make a small commit to Development branch
2. Push to trigger CI
3. CI will auto-promote to release
4. CD will attempt deployment
5. Check GitHub Actions logs for success

### Still Having Issues?

If the error persists:

1. **Check key permissions on VPS:**
   ```bash
   ssh root@your-vps
   ls -la ~/.ssh/authorized_keys
   # Should show: -rw------- (600)
   ```

2. **Verify SSH service on VPS:**
   ```bash
   sudo systemctl status ssh
   # Should be active (running)
   ```

3. **Check VPS firewall:**
   ```bash
   sudo ufw status
   # Port 22 should be allowed
   ```

4. **Test SSH manually:**
   ```bash
   ssh -i ~/.ssh/deploy_key root@your-vps-ip
   # Should connect without password
   ```

5. **Check GitHub Actions logs:**
   - Look for the exact error message
   - Verify the IP address is correct
   - Check if DNS resolution worked

### Security Notes

- **Never commit private keys to your repository**
- **Use dedicated deploy keys** (not your personal SSH key)
- **Rotate keys every 90 days**
- **Use ED25519 keys** (more secure than RSA)
- **Keep private keys at 600 permissions**

### Related Documentation

- [GitHub Secrets Setup Guide](./GITHUB_SECRETS_SETUP.md)
- [CI/CD Setup Guide](./CICD_SETUP.md)
- [Deployment Troubleshooting](./TROUBLESHOOTING.md)
