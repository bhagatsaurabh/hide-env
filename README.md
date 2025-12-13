<p align="center">
<a href="https://github.com/bhagatsaurabh/hide-env/actions/workflows/ci.yml" style="text-decoration: none;">
<img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/bhagatsaurabh/hide-env/ci.yml?branch=main&label=Build&logo=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAYAAABPYyMiAAAABGdBTUEAALGPC%2FxhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QAAAAAAAD5Q7t%2FAAAACXBIWXMAAABgAAAAYADwa0LPAAAAB3RJTUUH5gUMEiAyzA5gywAAAsBJREFUSMe9VF1Ik2EYPc%2FnXGP5UyGEFZUWxZRp9CdCbRXihQQKgxSCgogo%2FCG6yO2bsSIpZBfRRT90aYE3lpSIdZUsKHTfSiuTYlQ35m9dLSW37zvd9C2o1vyJzuX7Pud5z%2FMc3gP8QIDks7WrVjW%2FovH8W2kp5onF8kwoZoO5r0DmvpGRjA6I8Wpw0BehoR1rafmV4MsjtTVVVS3ryf77BQXz5aWCmMrNBsmbXEBcr19jEEBhT0%2FyPAryiNvNF0DGtY4OOQvR7169moonTwBY4nGUAThstSoPAP1De%2FvFuMju68PDPyfrJiPtqqquI7Xz9%2B75xsgXe4qK%2FrTyx7TZFsMjFcXvISPBtjZz87JQz5YK0zp9M5Cx1uVS%2FrcAvR%2B0BmMxCQESy8pKKyBAGv2bcnL8tTS0cFOTb4wMF7vdixUg5RB9dV2d8QEU76NHv1kQIKlpdvtcJgg6nRKFQLxe3AKAmhpMALIzkcAOEK0HDzIHwJ3KyowbgFHY2%2FvbxMsApcRmU95B8LCszAiD5NDQ5XxRdg51dlrMQnU5GTl%2B6FDCDvBWcbFEITgxMLDknYcAeqamZkJA%2FPalS1fyRSkfnZ1N3vsO0BhYs2WLaiEjffX1qSxQN5Kap7HR%2F57G8zMu15KFmfDvpxF%2B29AQIA0tnJf3zxrPEwpPQRR%2FLKZvgOifsrP%2Fv4CbgP60u5u7AMu7kyfNwDALzOAxA0b9SGpaV1e6yE3FU8NkeMbvN%2BuSv8AsVBoAo%2FroUUQB%2BhMJjgN46nLRA7BtelpWANJcU5N8KQbiQDCIbRBUf%2F6MWkD22mwoBLi9ouJvPFlXWirpJpgLAblZVVViB%2FQphwNdgLxpbaUK4MrkpHU5EO9zOC6ISPnoly%2FpeBBATk9MGDqQed3hWLBnahONyHhJiZnl8%2BWd20pDCzudXi%2F58uXKleb5d6Pys7dtSKvmAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDIyLTA1LTEyVDE4OjMyOjUwKzAwOjAwDrtGqwAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyMi0wNS0xMlQxODozMjo1MCswMDowMH%2Fm%2FhcAAAAASUVORK5CYII%3D&style=flat-square">
</a>
</p>

<p align="center">
The H-IDE Env template images for user workspaces
</p>

## Introduction

H-IDE Env images are self-contained base images used to provision user workspaces, these contain the required daemons to integrate with H-IDE platform, scripts to customize and auto-configure the workspace as per user demand and necessary pre-installed stack specific tools.

## Integration

H-IDE Env workspace integrates with the H-IDE platform over a single service.

This service handles affinity requests with the Env microservice, various IO operations and commands.

[API Spec ☍](https://github.com/bhagatsaurabh/hide-server/blob/main/api/services/wsenv.openapi.yml)
[Async Spec ☍](https://github.com/bhagatsaurabh/hide-server/blob/main/api/services/wsenv.asyncapi.yml)

<p align="center">
<img alt="WSEnv Daemon" src="https://github.com/bhagatsaurabh/hide-server/blob/main/docs/wsenv.svg" width="300" />
</p>

## Development

### Build images

```shell
npm run devbuild:<imagename>
```

```shell
npm run build:<imagename>
```

## Feedback

Feel free to send any feedback on personal@saurabhagat.me

## License

[MIT](https://github.com/bhagatsaurabh/hide-env/blob/main/LICENSE) Licensed | 2025-present | Saurabh Bhagat

## Attributions

- [Supervisord](https://github.com/Supervisor/supervisor)
