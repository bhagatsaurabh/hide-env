#!/bin/sh
set -e

# SSH Setup
mkdir -p /home/devuser/.ssh

if [ -f /config/authorized_keys ]; then
  cp /config/authorized_keys /home/devuser/.ssh/authorized_keys
elif [ -n "$SSH_PUBLIC_KEY" ]; then
  echo "$SSH_PUBLIC_KEY" >/home/devuser/.ssh/authorized_keys
  echo "$SSH_PUBLIC_KEY" >/config/authorized_keys
else
  echo "[WARN] No SSH key provided"
fi

chown -R devuser:devuser /home/devuser/.ssh
chmod 600 /home/devuser/.ssh/authorized_keys
if grep -q '^devuser:!' /etc/shadow; then
  passwd -u devuser
fi

# Stack custom extra packages & deps
CONFIG_PATH="/workspace/container.json"
configure_workspace() {
  if [ ! -f "$CONFIG_PATH" ]; then
    echo "[WARN] No container.json found at /workspace"
    return
  fi

  # Env variables
  if jq -e '.env' $CONFIG_FILE >/dev/null 2>&1; then
    for key in $(jq -r '.env | keys[]' $CONFIG_FILE); do
      if echo "$key" | grep -q "^HIDE_"; then
        val=$(jq -r ".env[\"$key\"]" $CONFIG_FILE)
        export "$key"="$val"
        echo "export $key='$val'" >> /home/devuser/.profile
      elif
        echo "[WARN] Ignoring not HIDE_ prefixed env variable $key"
      fi
    done
  fi

  # System packages
  if jq -e '.packages' $CONFIG_FILE >/dev/null 2>&1; then
    SYSTEM_PACKAGES=$(jq -r '.packages[]?' $CONFIG_FILE)
    if [ -n "$SYSTEM_PACKAGES" ]; then
      echo "Installing system packages: $SYSTEM_PACKAGES"
      apk update && apk add --no-cache $SYSTEM_PACKAGES || echo "[WARN] Failed to install some system packages"
    fi
  fi

  # Extra dependencies
  if jq -e '.template' $CONFIG_FILE >/dev/null 2>&1; then
    TEMPLATE=$(jq -r '.template' $CONFIG_FILE)
  else
    echo "[WARN] No template defined in container.json, falling back to 'empty'"
    TEMPLATE="empty"
  fi

  if jq -e '.dependencies' $CONFIG_FILE >/dev/null 2>&1; then
    DEPS=$(jq -r '.dependencies[]?' $CONFIG_FILE)
  else
    DEPS=""
  fi

  case "$TEMPLATE" in
    deno)
      [ -n "$DEPS" ] && deno install $DEPS
      ;;
    empty)
      echo "No default dependency handler."
      ;;
    go)
      [ -n "$DEPS" ] && go install $DEPS
      ;;
    nestjs|nodejs)
      [ -n "$DEPS" ] && npm install -g $DEPS
      ;;
    php)
      [ -n "$DEPS" ] && composer global require $DEPS
      ;;
    python)
      VENV_PATH="/workspace/.venv"
      if [ ! -d "$VENV_PATH" ]; then
          python3 -m venv "$VENV_PATH"
      fi
      . "$VENV_PATH/bin/activate"
      [ -n "$DEPS" ] && pip install --no-cache-dir $DEPS
      ;;
    rust)
      [ -n "$DEPS" ] && cargo install $DEPS
      ;;
    *)
      echo "[WARN] Unknown template: $TEMPLATE"
      ;;
  esac

  echo "Container setup complete"
}

configure_workspace >>/var/log/configurer.log 2>&1 &

/usr/bin/supervisord -c /etc/supervisord.conf

exec "$@"
