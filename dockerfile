FROM alpine:latest AS base

RUN apk add --no-cache \
  openssh \
  openssh-server \
  openssh-keygen \
  supervisor \
  git \
  jq

RUN ssh-keygen -A \
  && adduser -D -s /bin/sh devuser \
  && mkdir -p /home/devuser/.ssh \
  && chmod 700 /home/devuser/.ssh \
  && echo "PermitRootLogin no" >> /etc/ssh/sshd_config \
  && echo "PasswordAuthentication no" >> /etc/ssh/sshd_config \
  && echo "PubkeyAuthentication yes" >> /etc/ssh/sshd_config \
  && echo "AuthorizedKeysFile /home/devuser/.ssh/authorized_keys" >> /etc/ssh/sshd_config \
  && echo "AllowUsers devuser" >> /etc/ssh/sshd_config

WORKDIR /app
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
COPY motd /etc/motd

FROM golang:1.24-alpine AS development

WORKDIR /app
COPY filesystem ./filesystem
RUN go install github.com/air-verse/air@v1.62.0
COPY envs/supervisord-dev.conf /etc/supervisord.conf
COPY --from=base / /

EXPOSE 22
ENTRYPOINT ["/entrypoint.sh"]

FROM golang:1.24-alpine AS build

WORKDIR /app
COPY filesystem ./filesystem
WORKDIR /app/filesystem
RUN go build -o /main .

FROM base AS production

COPY --from=build /main /app/.build/main
COPY envs/supervisord.conf /etc/supervisord.conf

EXPOSE 22
ENTRYPOINT ["/entrypoint.sh"]
