---
title: 基于Seal语法树生成X86-64代码
top_img: false
cover: /img/compiler.jpg
date: 2020-12-15 16:51:54
tags:
- 编译原理
---

# 重新学习x86-64

用gcc将以下代码翻译成x86-64

```c
#include <stdio.h>

int main() {
    printf("hello world!\n");
    return 0;
}
```

```bash
gcc -S test.c
```

得到如下代码：

```assembly
	.file	"test.c"
	.text
	.section	.rodata
.LC0:
	.string	"hello world"
	.text
	.globl	main
	.type	main, @function
main:
.LFB0:
	.cfi_startproc
	pushq	%rbp
	.cfi_def_cfa_offset 16
	.cfi_offset 6, -16
	movq	%rsp, %rbp
	.cfi_def_cfa_register 6
	leaq	.LC0(%rip), %rdi
	call	puts@PLT
	movl	$0, %eax
	popq	%rbp
	.cfi_def_cfa 7, 8
	ret
	.cfi_endproc
.LFE0:
	.size	main, .-main
	.ident	"GCC: (GNU) 10.2.0"
	.section	.note.GNU-stack,"",@progbits
```

## 汇编程序的构成

### 指示 (Directives)

以**点号**开始，用来<font color=red>指示结构信息</font>。本身不是汇编指令。

比如：`.file`表示源文件名，`.string`表示字符串常量，`.global main`代表**标签**main是一个可以在其它模块的代码中被访问的全局符号 。还有一些杂七杂八的指示语句。

### 标签 (Labels)

以**冒号**结尾，将标签名和标签的位置关联。

以点号开始的标签都是编译器生成的临时局部标签，其它标签则是用户可见的函数和全局变量名称。

### 指令 (Instructions)

就是普通的x86-64指令，一般有缩进。

## 从Seal代码包给出的例子管中窥豹

不同的编译器翻译出来的汇编代码不一样，基本不是人读的。甚至不同的gcc版本都会翻译出不一样的代码。所以从助教给出的例子里找一找规律。

### hello world 程序

一个是用seal写的hello world程序：

```
func main() Void{
    printf("Hello world!");

    return;
}
```

对应的汇编：

```assembly
# start of generated code
	.section		.rodata	
.LC0:
	.string	"Hello world!"
	.text	
	.globl	main
	.type	main, @function
main:
	pushq	 %rbp
	movq	%rsp, %rbp
	pushq	 %rbx
	pushq	 %r10
	pushq	 %r11
	pushq	 %r12
	pushq	 %r13
	pushq	 %r14
	pushq	 %r15
	subq	$8, %rsp
	movq	$.LC0, %rax
	movq	%rax, -64(%rbp)
	movq	-64(%rbp), %rdi
	subq	$8, %rsp
	movl	$0, %eax
	call	 printf
	popq	 %r15
	popq	 %r14
	popq	 %r13
	popq	 %r12
	popq	 %r11
	popq	 %r10
	popq	 %rbx
	leave	
	ret	
	.size	main, .-main

# end of generated code
```

首先能看到一些之前用C写的hello world编译出来的代码里看不到的一些指示语句。分别是：`.section`、`.rodata`和`.type	main, @function`

Google了一下，`.rodata`代表了**常量区**，一般用于存放字符串常量，至于静态变量在不在这里，我也不知道，这个作业暂时不需要考虑。

`.section`和`.type	main, @function`没查到有什么意义，但是大致知道了程序结构。程序的开头如下：

```assembly
	.section		.rodata	
.LC0:
	.string	"Hello world!"
```

这一段存储字符串常量。

从`.text`开始，就是程序的正文。对每个函数`f`，都有以下的结构：

```assembly
	.globl	f
	.type	f, @function
f:
	...	//程序正文
	.size	f, .-f
```

### 更加复杂的程序

seal中内置了一个`printf`函数，来看一下是怎么用的。

一个Fibonacci程序：

```
func fib(x Int) Int {
    if x <= 2 {
        return 1;
    } 

    return fib(x-1) + fib(x-2);
}


func main() Void{
    var i Int;
    for i = 1;i < 15; i = i + 1 {
        printf("fib(%lld) = %lld \n", i, fib(i));
    }

    return;
}
```

转换后的汇编：

```assembly
# start of generated code
	.section		.rodata	
.LC0:
	.string	"fib(%lld) = %lld \n"
	.text	
	.globl	fib
	.type	fib, @function
fib:
	pushq	 %rbp
	movq	%rsp, %rbp
	pushq	 %rbx
	pushq	 %r10
	pushq	 %r11
	pushq	 %r12
	pushq	 %r13
	pushq	 %r14
	pushq	 %r15
	subq	$8, %rsp
	movq	%rdi, -64(%rbp)
	subq	$8, %rsp
	movq	$2, %rax
	movq	%rax, -72(%rbp)
	subq	$8, %rsp
	movq	-64(%rbp), %rax
	movq	-72(%rbp), %rdx
	cmpq	%rdx, %rax
	jle	 .POS2
	movq	$0, %rax
	jmp	 .POS3
.POS2:
	movq	$1, %rax
.POS3:
	movq	%rax, -80(%rbp)
	movq	-80(%rbp), %rax
	testq	%rax, %rax
	jz	 .POS0
	subq	$8, %rsp
	movq	$1, %rax
	movq	%rax, -88(%rbp)
	movq	-88(%rbp), %rax
	popq	 %r15
	popq	 %r14
	popq	 %r13
	popq	 %r12
	popq	 %r11
	popq	 %r10
	popq	 %rbx
	leave	
	ret	
	jmp	 .POS1
.POS0:
.POS1:
	subq	$8, %rsp
	movq	$1, %rax
	movq	%rax, -96(%rbp)
	subq	$8, %rsp
	movq	-64(%rbp), %rbx
	movq	-96(%rbp), %r10
	subq	%r10, %rbx
	movq	%rbx, -104(%rbp)
	movq	-104(%rbp), %rdi
	call	 fib
	subq	$8, %rsp
	movq	%rax, -112(%rbp)
	subq	$8, %rsp
	movq	$2, %rax
	movq	%rax, -120(%rbp)
	subq	$8, %rsp
	movq	-64(%rbp), %rbx
	movq	-120(%rbp), %r10
	subq	%r10, %rbx
	movq	%rbx, -128(%rbp)
	movq	-128(%rbp), %rdi
	call	 fib
	subq	$8, %rsp
	movq	%rax, -136(%rbp)
	subq	$8, %rsp
	movq	-112(%rbp), %rbx
	movq	-136(%rbp), %r10
	addq	%rbx, %r10
	movq	%r10, -144(%rbp)
	movq	-144(%rbp), %rax
	popq	 %r15
	popq	 %r14
	popq	 %r13
	popq	 %r12
	popq	 %r11
	popq	 %r10
	popq	 %rbx
	leave	
	ret	
	.size	fib, .-fib
	.globl	main
	.type	main, @function
main:
	pushq	 %rbp
	movq	%rsp, %rbp
	pushq	 %rbx
	pushq	 %r10
	pushq	 %r11
	pushq	 %r12
	pushq	 %r13
	pushq	 %r14
	pushq	 %r15
	subq	$8, %rsp
	subq	$8, %rsp
	movq	$1, %rax
	movq	%rax, -16(%rbp)
	movq	-16(%rbp), %rax
	movq	%rax, -8(%rbp)
.POS4:
	subq	$8, %rsp
	movq	$15, %rax
	movq	%rax, -24(%rbp)
	subq	$8, %rsp
	movq	-8(%rbp), %rax
	movq	-24(%rbp), %rdx
	cmpq	%rdx, %rax
	jl	 .POS7
	movq	$0, %rax
	jmp	 .POS8
.POS7:
	movq	$1, %rax
.POS8:
	movq	%rax, -32(%rbp)
	movq	-32(%rbp), %rax
	testq	%rax, %rax
	jz	 .POS6
	subq	$8, %rsp
	movq	$.LC0, %rax
	movq	%rax, -40(%rbp)
	movq	-8(%rbp), %rdi
	call	 fib
	subq	$8, %rsp
	movq	%rax, -48(%rbp)
	movq	-40(%rbp), %rdi
	movq	-8(%rbp), %rsi
	movq	-48(%rbp), %rdx
	subq	$8, %rsp
	movl	$0, %eax
	call	 printf
.POS5:
	subq	$8, %rsp
	movq	$1, %rax
	movq	%rax, -64(%rbp)
	subq	$8, %rsp
	movq	-8(%rbp), %rbx
	movq	-64(%rbp), %r10
	addq	%rbx, %r10
	movq	%r10, -72(%rbp)
	movq	-72(%rbp), %rax
	movq	%rax, -8(%rbp)
	jmp	 .POS4
.POS6:
	popq	 %r15
	popq	 %r14
	popq	 %r13
	popq	 %r12
	popq	 %r11
	popq	 %r10
	popq	 %rbx
	leave	
	ret	
	.size	main, .-main

# end of generated code

```

可以看到，程序的结构还是这样，只不过复杂的程序对应汇编代码正文比较长，但值得关注的是以下这行代码所对应的汇编语句：

```
printf("fib(%lld) = %lld \n", i, fib(i));
```

首先，字符串`"fib(%lld) = %lld \n"`是位于`.LC0`处的。把字符串的首地址存入内存

```assembly
	subq	$8, %rsp
	movq	$.LC0, %rax
	movq	%rax, -40(%rbp)
```

然后运算了`fib(i)`，变量`i` 在`-8(%rbp)`内存中。

```assembly
	movq	-8(%rbp), %rdi
	call	 fib
```

`fib`返回之后将`%rax`中的值存入内存，再调用`printf`函数

```assembly
	subq	$8, %rsp	// 分配内存
	movq	%rax, -48(%rbp)
	movq	-40(%rbp), %rdi	// 字符串
	movq	-8(%rbp), %rsi	// i
	movq	-48(%rbp), %rdx	// fib(i)
	subq	$8, %rsp
	movl	$0, %eax
	call	printf
```

除了这个比较复杂的函数以外，其他都没什么问题，要注意一下**caller-saved register**和**callee-saved register**。