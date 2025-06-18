#!/bin/sh
set -e

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
passwd -u devuser

/usr/bin/supervisord -c /etc/supervisord.conf
