#!/usr/bin/env bun
/**
 * LC-Coder CLI 入口
 * 小模型流水线编码工具
 */
import { runApp, resumeApp } from './cli/app.js';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'resume') {
  // 断点续传模式
  resumeApp().catch((err) => {
    console.error('致命错误:', err.message);
    process.exit(1);
  });
} else {
  // 正常模式
  runApp().catch((err) => {
    console.error('致命错误:', err.message);
    process.exit(1);
  });
}
