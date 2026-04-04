#!/usr/bin/env bun
/**
 * LC-Coder CLI 入口
 * 小模型流水线编码工具
 */
import { runApp } from './cli/app.js';

runApp().catch((err) => {
  console.error('致命错误:', err.message);
  process.exit(1);
});
