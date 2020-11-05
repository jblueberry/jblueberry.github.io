---
title: CSAPP Data Lab 随记
date: 2020-10-28 16:57:11
tags:
- CSAPP
- C Programming
top_img: false
cover: /img/CSAPP.jpeg
---
## bang
**bang - Compute !x without using !**

分治

```c
int bang(int x) {
  int y = x | (x>>16);

  y = y | (y>>8);
  y = y | (y>>4);
  y = y | (y>>2);
  y = y | (y>>1);

  return 1^(1&y);
}
```
## bitCount
**bitCount - returns count of number of 1's in word**

分治

```c
int bitCount(int x) {
  int mask = 0x11|(0x11<<8)|(0x11<<16)|(0x11<<24);
  int y = (x&mask)+((x>>1)&mask)+((x>>2)&mask)+((x>>3)&mask);
  int n1,n2,n3;

  y = y + (y>>16);
  n1 = y & 0xF;
  n2 = (y >> 4) & 0xF;
  n3 = (y >> 8) & 0xF;

  return n1+n2+n3+((y>>12) & 0xF);
}
```
## copyLSB
**copyLSB - set all bits of result to least significant bit of x**

比较简单
```c
int copyLSB(int x) {
  return (~(x&1)+1);
}
```
## divpwr2 
**divpwr2 - Compute x/(2^n), for 0 <= n <= 30**

需要用一个偏置量bias，这题我是抄的，思路待补充。
```c
int divpwr2(int x, int n) {
  int y = x>>31;
  x += (y & ((1<<n)+~0));
  return x >>n;
}
```
## evenBits 
**evenBits - return word with all even-numbered bits set to 1**

简单
```c
int evenBits(void) {
  return 0x55|(0x55<<8)|(0x55<<16)|(0x55<<24);
}
```
## fitsBits
**fitsBits - return 1 if x can be represented as an n-bit, two's complement integer.**

我感觉最难的题
假如x可以被n位bit表示，且x大于等于0时，那么x>>(n-1)一定等于0
如果x小于0，那么x>>(n-1)一定等于0xffffffff，即~(x>>(n-1))一定等于0
```c
int fitsBits(int x, int n) {
  int y = x >> 31;
  int z = n + (~1+1);
  return ((!y)&!(x>>z))|((y+2)&!(~(x>>z)));
}
```

## getByte
**getByte - Extract byte n from word x**

简单的
```c
int getByte(int x, int n) {
  return (x>>(n<<3))&0xFF;
}
```

## isGreater
**isGreater - if x > y  then return 1, else return 0 **

先剔除两个整数异号的情况，然后就好了

```c
int isGreater(int x, int y) {
  int particular1 = (y>>31)&1&!(x>>31);
  /*
   * particular1 = 1 when x>0 and y<0
   * particular1 = 0 otherwise
   */
  int particular2 = (x>>31)&1&!(y>>31);
  /*
   * particular2 = 1 when x<0 and y>0
   * particular2 = 0 otherwise
   */
  /*
   * if p1 = 1 return 1
   * else if p2=1 return 0
   * else return normal
   */

  return particular1|((!particular2)&((~x+1+y)>>31)&1);
}
```

## isNonNegative
**isNonNegative - return 1 if x >= 0, return 0 otherwise **

```c
int isNonNegative(int x) {
  return !(x>>31);
}
```

## isNotEqual
**isNotEqual - return 0 if x == y, and 1 otherwise**

```c
int isNotEqual(int x, int y) {
  return !!(x^y);
}
```

## isPower2
**isPower2 - returns 1 if x is a power of 2, and 0 otherwise**

这道题不简单，但是思路已经忘记了，想起来再写。应该用了分组处理的办法

```c
int isPower2(int x) {
  int mask = 0x11|(0x11<<8)|(0x11<<16)|(0x11<<24);
  int y = (x&mask)+((x>>1)&mask)+((x>>2)&mask)+((x>>3)&mask);
  int n,n2,n3;

  y = y + (y>>16);
  n = y & 0xF;
  n2 = (y >> 4) & 0xF;
  n3 = (y >> 8) & 0xF;
  n = n+n2+n3+((y>>12) & 0xF);

  return ((!(x>>31))&(n&1)&!(n>>1));
}
```

## leastBitPos
**leastBitPos - return a mask that marks the position of the least significant 1 bit. If x == 0, return 0**
```c
int leastBitPos(int x) {
  return (~x+1) & x;
}
```

## logicalShift
**logicalShift - shift x to the right by n, using a logical shift**

也没什么难度
```c
int logicalShift(int x, int n) {
  unsigned int mask = (0xff)|(0xff<<8);
  mask = mask | (mask<<16);
  
  return (x>>n)&(mask>>n);
}
```
## satAdd 
**satAdd - adds two numbers but when positive overflow occurs, returns maximum possible value, and when negative overflow occurs, it returns minimum positive value.**

我自认为第二难的一道题
如果产生positive overflow，x+y\<x
如果产生negative overflow，x+y\>x

```c
int satAdd(int x, int y) {
  int out = x + y;
  int mask1 = (~(x>>31))&(~(y>>31))&(out>>31); // if positive overflow, mask1 = -1, or = 0
  int mask2 = (x>>31)&(y>>31)&(~(out>>31)); // if negative overflow, mask2 = -1, or = 0
  int Min = 1<<31;
  int Max = Min+(~1+1);
  return ((~mask1)&(~mask2)&(x+y))|(mask1&Max)|(mask2&Min);
}
```

## tc2sm
**tc2sm - Convert from two's complement to sign-magnitude where the MSB is the sign bit**

简单的
```c
int tc2sm(int x) {
  int mask = x >> 31;
  return (mask&(1<<31))|((x^mask)+(mask&1));
}
```