---
title: "CSAPP Chapter 10"
date: 2021-05-12T16:45:57+08:00
draft: true
---


## RIO without buffer

```C
ssize_t rio_readn(int fd, void *usrbuf, size_t n);
```

和 Unix IO 的 `read` 函数的区别：

- 被中断打断可以重新读

成功时返回 0， 遇到 EOF 时同样返回差值。

```C
ssize_t rio_writen(int fd, void *usrbuf, size_t n);
```

- 被中断打断可以重新写
- 失败时返回 -1

## RIO Input with buffer

- `void rio_readinitb(rio_t *rp, int fd);`

将文件描述符 `fd` 与 读缓冲区 `rp` 绑定

```C
#define RIO_BUFSIZE 8192
typedef struct {
    int rio_fd;
    int rio_cnt;				/* 应用级缓冲中未被使用的字节数 */
    char *rio_bufptr;			/* 下一个未被读取的字节地址 */
    char rio_buf[RIO_BUFSIZE];	/* buffer */
} rio_t;

void rio_readinitb(rio_t *rp, int fd) {
    rp->rio_fd = fd;
    rp->rio_cnt = 0;
    rp->rio_bufptr = rp->rio_buf;
}
```

- 辅助函数：`static ssize_t rio_read(rio_t *rp, char *usrbuf, size_t n);`

对于应用程序来说，`rio_read` 和 Unix IO 提供的 `read` 的语义是一样的。

```C
static ssize_t rio_read(rio_t *rp, char *usrbuf, size_t n) {
    
    int cnt;
    while (rp->rio_cnt <= 0) {
        rp->rio_cnt = read(rp->rio_fd, rp->rio_buf, sizeof(rp->rio_buf));
        
        if(rp->rio_cnt < 0) {
            if (errno != EINTR)
                return -1; /* 被除了 sig handler 以外的中断打断，说明出错了 */
        }
        else if (rp->rio_cnt == 0)
            return 0; /* 读到 EOF 了，结束 */
        else
            rp->rio_bufptr = rp->rio_buf;
        /* 这里隐含了一件事情，当 rp->rio_cnt<0 且 errno = EINTR 时，会重新读 */
    }
    
    /* 将 min(n, rp->rio_cnt) 数量的字节拷贝到 usrbuf */
    /* 返回 min(n, rp->rio_cnt) */
    /* 当所需要读取的字节数超过了缓冲区内空闲的字节数量，返回剩下的数量 */
    
    cnt = n;
    if (rp->rio_cnt < n)
        cnt = rp->rio_cnt;
    memcpy(usrbuf, rp->rio_bufptr, cnt);
    rp->rio_bufptr += cnt;
    rp->rio_cnt -=cnt;
    return cnt;
}
```

- 读取一行：`ssize_t rio_readlineb(rio_t *rp, void *usrbuf, size_t maxlen);`

```C
ssize_t rio_readlineb(rio_t *rp, void *usrbuf, size_t maxlen) {
    
    /* 至多读取 maxlen-1 个字符，因为有字符串结束符 */
    int n, rc;
    char c, *bufp = usrbuf;
    
    for (n = 1; n < maxlen; n++) {
        if ((rc = rio_read(rp, &c, 1)) == 1) {
            *bufp++ = c;
            if (c == '\n') {
                n++;
                break;
            }
        } else if (rc == 0) {
            if (n == 1)
                return 0;
            else
                break;
        } else
            return -1;
    }
    *bufp = 0;
    return n-1;
}
```

- 读取 `n` 个字符：`ssize_t rio_readnb(rio_t *rp, void *usrbuf, size_t n);`

```C
ssize_t rio_readnb(rio_t *rp, void *usrbuf, size_t n) {
    size_t nleft = n;
    ssize_t nread;
    char *bufp = usrbuf;
    while(nleft > 0) {
        if(nread = rio_read(rp, usrbuf, nleft) < 0)
            return -1; /* 出错 */
        else if (nread == 0)
            break;
        nleft -= nread;
        bufp += nread;
    }
    return n-nleft;
}
```

**带缓冲的函数可以任意交叉运行，线程安全，但不可以和无缓冲的 `rio_readn` 交叉使用**。因为部分数据还存留在应用层的缓冲区内。

## 为什么网络编程不要用标准 I/O？

```C
#include "unp.h"

void str_echo(int sockfd) {
    char line[MAXLINE];
    FILE *fpin, *fpout;
    
    fpin = Fdopen(sockfd, "r");
    fpout = Fdopen(sockfd, "w");
    
    while (Fgets(line, MAXLINE, fpin) != NULL)
        Fputs(lines, fpout);
}
```

1. 先调用 `fdopen` 创建两个标准 I/O Stream，一个用于输入一个用于输出。

## Proxy lab

proxy 需要往屏幕上打印日志，格式：

`Date: browserIP URL size`

`size` 是代理程序从连接建立到连接关闭中从服务器收到的字节数，只有被服务器响应的请求才会被记录。

### 一些辅助函数

1. `int getaddrinfo(const char *host, const char *service, const struct addrinfo *hints, struct addrinfo **result);`

   处理**名字到地址**以及**服务到端口**这两种转换

   参数：

   - `hostname`：一个主机名或者一个地址串
   - `service`：十进制端口号或者是预先定义好的服务名
   - `hints`：一个指向 `addrinfo` 结构体的指针，包含期望返回的格式信息
   - `result`：函数通过该指针返回一个**指向 `addrinfo` 链表的指针**

   返回值：

   - 成功：0
   - 出错：非 0

   

