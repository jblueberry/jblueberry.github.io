---
title: ICS Lab  难点集锦
date: 2020-10-30 16:57:11
tags:
- CSAPP
- C Programming
top_img: false
cover: /img/cover.png
---
## DataLab
1. bang 分治
2. bitCount 分治
3. copyLSB 简单
4. divpwr2 需要用一个偏置量bias，待补充
5. evenBits 简单
6. fitsBits 我自认为第二难的题
假如x可以被n位bit表示，且x大于等于0时，那么x>>(n-1)一定等于0
如果x小于0，那么x>>(n-1)一定等于0xffffffff，即~(x>>(n-1))一定等于0
```C
int fitsBits(int x, int n) {
  int y = x >> 31;
  int z = n + (~1+1);
  return ((!y)&!(x>>z))|((y+2)&!(~(x>>z)));
}
```
7. satAdd 我自认为最难的一道题
如果产生positive overflow，x+y\<x
如果产生negative overflow，x+y\>x
好吧 我看错题目要求了，其实没那么难