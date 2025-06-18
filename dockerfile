FROM node:20-alpine AS base

RUN wget https://go.dev/dl/go1.24.2.linux-amd64.tar.gz \
  && tar -C /usr/local -xzf go1.24.2.linux-amd64.tar.gz \
  && echo "export PATH=\$PATH:/usr/local/go/bin" >> ~/.profile \
  && source ~/.profile
RUN apk add jq openssh openssh-server openssh-keygen supervisor
RUN ssh-keygen -A
RUN adduser -D -s /bin/sh devuser \
  && mkdir -p /home/devuser/.ssh \
  && chmod 700 /home/devuser/.ssh
RUN echo "PermitRootLogin no" >> /etc/ssh/sshd_config \
  && echo "PasswordAuthentication no" >> /etc/ssh/sshd_config \
  && echo "PubkeyAuthentication yes" >> /etc/ssh/sshd_config \
  && echo "AuthorizedKeysFile /home/devuser/.ssh/authorized_keys" >> /etc/ssh/sshd_config \
  && echo "AllowUsers devuser" >> /etc/ssh/sshd_config
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /app
ENV PATH="/usr/local/go/bin:/root/go/bin:${PATH}"

FROM base AS development
COPY env-gateway ./env-gateway
RUN cd ./env-gateway && npm ci
COPY filesystem ./filesystem
RUN go install github.com/air-verse/air@latest
COPY envs/supervisord-dev.conf /etc/supervisord.conf
EXPOSE 22
ENTRYPOINT ["/entrypoint.sh"]

FROM base AS builder
COPY env-gateway ./env-gateway
RUN cd ./env-gateway && npm ci
RUN npm run build --prefix env-gateway

FROM base AS production
COPY --from=builder /app/env-gateway/dist ./env-gateway/dist
COPY --from=builder /app/env-gateway/package.json ./env-gateway/package.json
COPY --from=builder /app/env-gateway/package-lock.json ./env-gateway/package-lock.json
COPY --from=builder /app/env-gateway/node_modules ./env-gateway/node_modules
COPY envs/supervisord.conf /etc/supervisord.conf

EXPOSE 22
ENTRYPOINT ["/entrypoint.sh"]