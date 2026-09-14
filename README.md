# Dualine

左边一篇散文，右边它解释的真代码。滚着读，两者不走丢。

A facing-page reader: the essay on the left, the real code it faces on the right.

**[打开对照](https://qzyh123.github.io/Dualine/)** — Dualine 读自己，不用安装。

![滚着读，代码跟着走](docs/ritual.gif)

## 装一次

需要 Node 20.19+ 或 22.12+。包还是 `private`，不在 npm 上，所以从仓库装：

```sh
git clone https://github.com/QZYH123/Dualine.git
cd Dualine
npm install && npm run build && npm link
```

之后任何地方都有 `dualine` 这条命令。

## 读自己的项目

到项目文件夹里：

```sh
dualine init    # 还没有 gloss.md 时：写一份起步笔记，装上 write-gloss 技能
dualine .       # 一个端口，浏览器自己打开
```

`init` 之后把它打印的那句话交给你的 agent，让它读 `.cursor/skills/write-gloss/SKILL.md`、为这个项目写 `gloss.md`。Dualine 只负责读，不生成散文。

改 `gloss.md` 时桅头会出现 **已更新**，点了才重载，不抢阅读位置。章节在 URL 里是 `#c3`。

## 写出对照笔记

Markdown 加一种锚点：`[这句话](src/server.ts#L18-L59)` 对着真实行号。

```md
---
name: shortly
tagline: 一个短链接服务
lang: typescript
---

# shortly 是怎么工作的

## 它做什么

整个服务是[三个 HTTP 接口](src/server.ts#L18-L59)……
```

`#` 是标题，`##` 是章。没有锚点的段落继承上一段的代码。范本：`examples/shortly/gloss.md`。任何语言都会高亮，语法按文件后缀在用到时才加载。

大一点的仓库按子系统分开写：根上的 `gloss.md` 是主篇，`gloss/<topic>.md` 每篇一个子系统（文件名即笔记 id，锚点仍相对项目根）。目录里它们排在章前，`?note=<topic>` 打开某一篇。只有 `gloss.md` 时，什么都不多显示。

## 锚点会老

代码会动，行号不会自己跟上。

```sh
dualine check .          # 锚点是否落在文件里，正文是否还对得上 gloss.lock
dualine check . --fix    # 原文还在、只是行号挪了：改 gloss.md 和锁
dualine check . --accept # 你有意改写了散文或范围之后，重写锁
```

`gloss.lock` 记住每枚锚点面对的那几行代码的指纹。第一次干净通过的 `check` 写下它作基线；之后行号合法但指纹变了，说明代码真的改了，散文得重读。找不到原文或出现多处，仍算问题。锁按锚点目标记，不按段落位置——插一章、调个顺序，锁不动。和 `gloss.md` 一起提交。

阅读器里的警示条只说「已挪到 L23–L64」，改是你在命令行里做的、能 diff 能提交的事。

## 带走一张对照页

```sh
dualine export .    # → export/<id>/
```

打开其中的 `index.html`，不用跑任何东西。上面的在线演示就是这样冻出来的。

## 改 Dualine 自己

```sh
npm run dev:all    # 网页 :5173 + API 127.0.0.1:8787，一次 Ctrl-C 两边都停
npm run check      # 类型检查、校验 examples/ 和本仓库自己的 gloss.md、跑测试
```

读 Dualine 自己：`GLOSS_PROJECTS_DIR=$PWD npm run dev:all`，然后 <http://localhost:5173/?project=dualine>。只跑 `npm run dev` 时，API 不在就回落到打包的 shortly 示例。

`GLOSS_PROJECTS_DIR` 也可以指到「每个子文件夹一个项目」的目录，子文件夹名就是 id（小写字母、数字、`-` 或 `_`），`?project=<id>` 选一个，没有时打开排在最前的。`npm run check:gloss -- <目录>` 校验整个目录。

| 环境变量 | 默认 | |
|---|---|---|
| `GLOSS_PROJECTS_DIR` | 本仓库 `examples/` | 多项目目录；会展开 `~/`、`$HOME/` |
| `GLOSS_PROJECT_DIR` | （不设） | 单项目：这个文件夹就是唯一项目；文件夹名收成 id。`dualine .` 用的就是它 |
| `GLOSS_SERVE_DIST` | （不设） | API 同时托管该目录的静态文件（CLI 指向仓库里的 `dist/`） |
| `PORT` | `8787` | API 端口；`dualine` 被占时接着往后试 |
| `HOST` | `127.0.0.1` | API 只绑本机。要对外必须显式 `HOST=0.0.0.0` |
| `GLOSS_API` | `http://127.0.0.1:$PORT` | 开发栈里网页代理 API 的地址 |

对照需要大约 1100px 宽的窗口；更窄会直接说明，而不是把两栏叠起来。跟随系统的深色模式有一套夜纸，没有开关。

## 还没做的事

- Dualine 不从代码生成散文。
- 没有远程 clone。
- 窄屏不是目标。

MIT。这是本地应用；`private: true`，还没发到 npm。
