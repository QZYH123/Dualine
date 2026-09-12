---
name: dualine
tagline: 散文对着代码读
lang: typescript
---

# dualine 是怎么对照的

一份对照阅读器。左边是分章的散文，右边是它解释的真实代码，两者始终对着。这份笔记按一次打开来读它：从 URL 决定读谁，到 `gloss.md` 变成结构，再到滚动时代码跟着走。

## 它做什么

dualine 只做一件事：让人读完一篇短文，觉得自己摸清了一个项目。屏幕上永远是[同一套对照](src/App.tsx#L86-L103)——有项目就进 `Reader`，没有就停在一句说明。它不生成散文，不挑仓库，不把两栏叠起来凑合窄屏。

入口几乎没有逻辑。[`main.tsx`](src/main.tsx#L6-L10) 把 `App` 挂上，样式从这里进来。真正的分叉在 `App`：高亮器和项目都就绪之后，要么对照，要么通知。

## 打开一页

要读哪一个，写在 URL 里：`?project=<id>`。没有 query 时，打开目录里排在最前的那一项。

加载分两步。[先问目录，再问正文](src/lib/load.ts#L75-L99)。目录的结果交给 [`afterList`](src/lib/load-decision.ts#L103-L114)：文件夹不存在、是空的、API 挂了，各自变成一种通知，绝不悄悄换成示例。只有 API 真的够不着、而你又没点名别的项目时，才用打包进来的 shortly。

磁盘上的笔记一改，页面不会自己抢焦点。`App` [每隔两秒半问一次 `rev`](src/App.tsx#L38-L59)；对不上就亮一颗「已更新」，点了才重新载入。阅读位置是你的，不是文件监视器的。

## 笔记的结构

`gloss.md` 不是博客，是一份对着代码的文书。模型很窄：一篇文档、若干章、每章里一段段 *passage*，每段面对一个 [`CodeRef`](src/lib/gloss.ts#L11-L15)——文件加上 1-based 的闭区间。

解析按空行切段。[`#` 是标题，`##` 是章](src/lib/gloss.ts#L227-L245)；标题下、第一章前的段落是导语，不驱动代码栏。每一段的面对范围是：段首的 `@[path#L1-L9]`，否则段内第一枚锚点，否则继承上一段。[`parseRef`](src/lib/gloss.ts#L69-L75) 认 `path#L18-L59` 这种写法，单行 `#L15` 也可以，写反了会排好。

普通 Markdown 链接如果不是这种靶，会原样留在字里——所以不要用它做站外跳转。

继承是事后补的。[`resolveRefs`](src/lib/gloss.ts#L271-L279) 顺着全部段落走一遍，把空的 `ref` 填成「目前面对的那一段」。跨章也继承，所以连续几段讲同一段代码，不必反复贴同一条链接。

## 从磁盘读进来

浏览器不碰文件系统。本地 API 是一个 [只回答 GET 的小接口](server/index.ts#L41-L105)：目录、健康检查、项目正文，以及给「已更新」用的 `rev`，都走这里。

[`listProjects`](server/projects.ts#L85-L91) 先看子文件夹里有没有 `gloss.md`。一个都没有、而这个文件夹自己就有，并且文件夹名是合法 id，就把它当成唯一的项目。两者都有时，子项目赢——目录还是目录。

读某一个 id 时，[`resolveProjectDir`](server/projects.ts#L94-L109) 同样先找 `<root>/<id>`，找不到再看 `<root>` 自己是不是这个 id。正文从目录装进来：[锚点点到的文件，外加 `src/` 下的文本](server/projects.ts#L169-L188)，跳过二进制、隐藏文件和 `node_modules`。落点对不对，和 `check:gloss` 走[同一份校验](server/validate.ts#L202-L235)，结果写成 `warnings` 交给界面。

`rev` 是 [gloss.md 和它面对的文件的最新 mtime](server/projects.ts#L112-L139)。只用来判断「和你打开时相比，磁盘上有没有动过」。

## 对照怎么对齐

仪式在 [`useReadingSync`](src/reader/useReadingSync.ts#L1-L8) 里写死了。视口大约三分之一处有一条阅读线。[刚越过这条线的段落是当前段](src/reader/useReadingSync.ts#L85-L98)。代码栏用 `top` 把该段面对的第一行，送到和段落第一行齐平的位置；换段时加一段缓动。用 `top` 而不是 `transform`，是为了让行号能粘在窗格左边。

对齐时有两条夹板：[长段往上读，焦点不要滑出顶](src/reader/useReadingSync.ts#L140-L146)；文件开头也不要掉到阅读线下面。栏间那根朱线，连的是段落和它面对的行；针定之后你若继续滚散文，短语离开了，线就收起来，免得撒谎。

指针在代码栏上滚动时，[滚的是代码，不是整页](src/reader/useReadingSync.ts#L174-L190)。再滚散文，它会弹回对齐。

## 锚点与固定

下划线短语是细的绳子。悬停只点亮那几行；点击则[切换固定](src/reader/Reader.tsx#L112-L114)——代码停住，散文还可以往下读。[`Esc` 全局释放](src/reader/Reader.tsx#L118-L124)，代码栏标题上那颗按钮也是。

锚点在散文里是一条 [`<a>`](src/reader/Prose.tsx#L111-L134)：`href` 只是占位，点击被拦住，真正发生的是 pin。标题属性写出文件和行号，悬停、聚焦都会把对面的行洗成朱。

章的位置写在 URL 的 `#c3` 里。点目录会推进历史；自己滚的时候只替换，避免中间几章挤进后退栈。

## 代码回指

散文能指到行，行也能指回散文。每条有注解的代码行，会去反查[覆盖它的最窄锚点](src/lib/gloss.ts#L292-L310)。宽的教学跨度不要再被后来的一行 `#L18` 抢走——后来的句子应该指到更里面。

点这样一行，[`jumpToAnchor`](src/reader/Reader.tsx#L133-L170) 把解释它的段落送到阅读线；滚动停稳之后再 pin，代码才稳住，好让你对着读。拖过一行选中文字，不会误针定。

高亮是 Shiki 做的，颜色却不跟主题走：token 被标成 CSS 类，朱、墨、纸都在样式里。[语言只预装了 TypeScript、JavaScript 和 JSON](src/lib/highlight.ts#L100-L109)，这份笔记因此只指 `.ts` / `.tsx`。

## 还没做的事

读到这里，对照的闭环已经走完。有几件事它故意不做。

它不从代码生成散文。`App` 只读已经写好的 `gloss.md`；起草是仓库里的 `write-gloss` 技能，或你自己写。

它不做项目选择器。换项目改 URL。API 挂了、你又点了别的 id，[不会假装 shortly 就是你要的那个](src/lib/load-decision.ts#L96-L101)。

窄窗口不硬叠。[低于约 1000px 只说需要更宽的窗口](src/reader/Reader.tsx#L257-L265)，对照仪式保持诚实。

API 默认绑在 [127.0.0.1](server/index.ts#L129-L132)。这是给本机读磁盘用的；要暴露出去，得显式改 `HOST`。
