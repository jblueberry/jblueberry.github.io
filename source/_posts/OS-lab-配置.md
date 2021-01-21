---
title: OS lab 配置
top_img: false
cover: /img/OS.jpg
date: 2021-01-21 22:32:42
tags:
- OS
---

折腾了一段时间，记录一下。

我本来有安装Docker，但是速度真的奇慢无比，加了一个阿里镜像。

```bash
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://58pbs4zu.mirror.aliyuncs.com"]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

安装qemu，Arch下还要多安装一个qemu-arch-extra来支持x86_64以外的汇编。

```bash
sudo pacman -S qemu-arch-extra
```

然后就好了