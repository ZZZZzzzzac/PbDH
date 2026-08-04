# AGENTS.md

## 项目概述

PbDH 是桌游工具项目。默认使用 Python 与 Web 前端；未明确需求前，不引入具体框架。

## 工作规则

- 默认使用中文沟通；代码、命令、变量名使用英文，注释使用中文。
- 修改前先阅读本文件，以及 `docs/agents/` 下与任务相关的规则。
- 先明确可验证目标，再实施；实质性修改后运行对应验证。
- 只修改任务需要的内容，保持 diff 简洁，清理因修改产生的无用代码。
- 不提交密钥、token、密码或本地环境文件。
- 删除文件时移到回收站，不直接执行删除命令。

## 目录约定

- `src/`：产品源代码
- `tests/`：自动化测试
- `scripts/`：一次性或开发辅助脚本
- `docs/`：项目文档与 ADR
- `.scratch/`：临时 issue/研究材料；正式工作项使用 GitHub Issues

## Agent skills

### Issue tracker

本项目使用 GitHub Issues，操作通过 `gh` CLI 完成。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认五类 triage labels：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

本项目采用 single-context 文档布局。详见 `docs/agents/domain.md`。
