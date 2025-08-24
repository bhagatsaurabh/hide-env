#!/bin/sh
set -e

# SSH Setup
mkdir -p /home/devuser/.ssh

if [ -f /devconfig/authorized_keys ]; then
  cp /devconfig/authorized_keys /home/devuser/.ssh/authorized_keys
elif [ -n "$SSH_PUBLIC_KEY" ]; then
  echo "$SSH_PUBLIC_KEY" >/home/devuser/.ssh/authorized_keys
  echo "$SSH_PUBLIC_KEY" >/devconfig/authorized_keys
else
  echo "[WARN] No SSH key provided"
fi

chown -R devuser:devuser /home/devuser/.ssh
chmod 600 /home/devuser/.ssh/authorized_keys
if grep -q '^devuser:!' /etc/shadow; then
  passwd -u devuser
fi

# Stack specific setup


# Stack custom extra packages & deps
CONFIG_PATH="/workspace/devconfig.json"
configure_workspace() {
  if [ ! -f "$CONFIG_PATH" ]; then
    echo "[WARN] No devconfig.json found at $CONFIG_PATH"
    return
  fi

  # Install packages
  apk_pkgs=$(jq -r '.packages[]?' "$CONFIG_PATH" 2>/dev/null || true)
  if [ -n "$apk_pkgs" ]; then
    apk update && apk add --no-cache $apk_pkgs || echo "[WARN] Failed to install some packages"
  fi
}
configure_workspace >>/var/log/configurer.log 2>&1 &

/usr/bin/supervisord -c /etc/supervisord.conf

exec "$@"
