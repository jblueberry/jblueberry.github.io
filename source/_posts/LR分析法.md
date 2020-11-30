---
title: LR分析法
top_img: false
cover: /img/cover.jpg
date: 2020-11-30 13:05:40
tags:
- 编译原理
katex: true
---

LR分析法是比较麻烦的一种自底向上的分析方法。整体思路在于**寻找句柄**和**最左规约**。

在分析字符串时，将待分析字符串从左至右push到stack中，一旦出现句柄，就规约。