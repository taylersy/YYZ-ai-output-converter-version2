import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { saveAs } from 'file-saver';
import MathEditor from './components/MathEditor';
import { generateDocx, ExportConfig } from './utils/MarkdownToDocx';
import AuthModal from './components/AuthModal';
import { authService } from './utils/auth';
import { normalizeMarkdown } from './utils/textUtils';
import './App.css';

const FONT_SIZES = [
  { label: '初号 (42pt)', value: 42 },
  { label: '小初 (36pt)', value: 36 },
  { label: '一号 (26pt)', value: 26 },
  { label: '小一 (24pt)', value: 24 },
  { label: '二号 (22pt)', value: 22 },
  { label: '小二 (18pt)', value: 18 },
  { label: '三号 (16pt)', value: 16 },
  { label: '小三 (15pt)', value: 15 },
  { label: '四号 (14pt)', value: 14 },
  { label: '小四 (12pt)', value: 12 },
  { label: '五号 (10.5pt)', value: 10.5 },
  { label: '小五 (9pt)', value: 9 },
];

function App() {
  const [markdown, setMarkdown] = useState<string>(`# 第一章 绪论

## 1.1 研究背景
这是一个支持 **Markdown** 表格、多级标题和 **LaTeX 数学公式** 的高级转换器。

## 1.2 实验数据
以下是符合学术标准“三线表”格式的表格示例：

| 参数名称 | 符号 | 数值 | 单位 |
| :--- | :---: | :---: | :--- |
| 普朗克常数 | $h$ | $6.626 \\times 10^{-34}$ | J·s |
| 光速 | $c$ | $2.998 \\times 10^8$ | m/s |
| 电子质量 | $m_e$ | $9.109 \\times 10^{-31}$ | kg |

# 第二章 理论分析

## 2.1 核心公式
行内公式: $E = mc^2$

块级公式:
$$ \\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2} $$

# 复杂公式测试

## 麦克斯韦方程组 (积分形式)
$$ \\oint_S \\mathbf{E} \\cdot d\\mathbf{A} = \\frac{Q_{enc}}{\\varepsilon_0} $$
$$ \\oint_S \\mathbf{B} \\cdot d\\mathbf{A} = 0 $$
$$ \\oint_C \\mathbf{E} \\cdot d\\mathbf{l} = -\\frac{d\\Phi_B}{dt} $$
$$ \\oint_C \\mathbf{B} \\cdot d\\mathbf{l} = \\mu_0 I_{enc} + \\mu_0 \\varepsilon_0 \\frac{d\\Phi_E}{dt} $$

## 薛定谔方程
$$ i\\hbar\\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r},t) = \\left [ \\frac{-\\hbar^2}{2m}\\nabla^2 + V(\\mathbf{r},t)\\right ] \\Psi(\\mathbf{r},t) $$

## 矩阵示例
$$
\\begin{bmatrix}
   a & b & c \\\\
   d & e & f \\\\
   g & h & i
\\end{bmatrix}
$$

## 复杂分式与积分
$$ f(x) = \\int_{-\\infty}^\\infty \\frac{e^{-x^2}}{\\sqrt{2\\pi}} dx + \\sum_{n=1}^\\infty \\frac{1}{n^2} = \\frac{\\pi^2}{6} + 1 $$

## 表格换行与公式混合测试
| 列1 | 列2 |
| --- | --- |
| 第一行 | 这是第一行<br>这是第二行 |
| 公式行 | $d_1$: 这是行内公式测试<br>$d_2$: 第二个公式 |
| A | B<br/>C |

## 公式修复测试
1. 从感性到理性(几何 $\\rightarrow$ 代数):遵循认知规律
2. 定义变量集合 $X$(备选方案):
3. 定义评价维度集合 $D$(评价指标):
4. 核心探究:权重的博弈 $W$ 本质上是价值观的数学表达。

## 列表测试
1. 这是第一项（有序列表），应该显示为“1. ...”而不是黑点。
2. 这是第二项。
3. 带有公式的列表项：$E=mc^2$。

* 这是无序列表项，应该显示为黑点。
-这也是无序列表项。

## 缩进与斜体测试
这是一个普通段落，应该保持原样，不自动缩进。
    这是一个已经手动缩进的段落，保持原样。

*这是斜体文本测试*，由于回退了斜体解析，这里应该显示为带星号的普通文本。

**这是粗体文本测试**，正常段落。

你可以点击下方的“下载 Word”按钮，导出的文档将具备：
1. **多级标题自动编号** (1. / 1.1 / 1.1.1)
2. **学术三线表** (粗上下框线，无竖线)
3. **标准字体与行间距** (Times New Roman, 1.5倍行距)
4. **公式可编辑** (Word 原生公式对象)`);
  const [showAbout, setShowAbout] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    mainFont: {
      ascii: 'Times New Roman',
      eastAsia: 'SimSun' // 宋体
    },
    mathFont: 'Times New Roman',
    mathFontSize: 12,
    lineSpacing: 1.5,
    fontSize: 12
  });

  const handleInsertMath = (latex: string) => {
    setMarkdown(prev => prev + latex);
  };

  const handleClear = () => {
    if (window.confirm('确定要清空所有内容吗？')) {
      setMarkdown('');
    }
  };

  const handleDownload = async () => {
    const token = authService.getToken();
    if (!token) {
      setAuthModalMessage('请先登录或注册以使用下载功能');
      setShowAuthModal(true);
      return;
    }

    setIsConverting(true);
    try {
      const permission = await authService.checkPermission();
      if (!permission.allowed) {
        alert('您的会员已过期或无效，请重新验证');
        authService.clearToken();
        setAuthModalMessage('您的会员已过期或无效，请重新登录');
        setShowAuthModal(true);
        setIsConverting(false);
        return;
      }

      const blob = await generateDocx(markdown, exportConfig);
      saveAs(blob, 'translated_document.docx');
    } catch (error) {
      console.error('Conversion failed:', error);
      alert('转换失败，请检查控制台日志。');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-logo">
          <h1>AI学术输出格式转换器</h1>
          <span className="version-tag">Pro</span>
        </div>
        <div className="header-actions">
          <button className="nav-btn" onClick={() => setShowConfig(true)}>
            <span className="icon">⚙️</span> 导出设置
          </button>
          <button className="nav-btn" onClick={() => setShowAbout(true)}>
            <span className="icon">ℹ️</span> 关于
          </button>
        </div>
      </header>

      <div className="hero-section">
        <h2 className="hero-title">专为学术写作而生，让排版回归纯粹</h2>
        <p className="hero-subtitle">
          完美解析 LaTeX 复杂公式 · 精准还原 Markdown 嵌套格式 · 一键生成符合出版标准的 Word 文档
        </p>
        <div className="hero-features">
          <span className="feature-tag">✨ 原生公式支持</span>
          <span className="feature-tag">🚀 智能排版优化</span>
          <span className="feature-tag">🔒 纯前端安全处理</span>
        </div>
      </div>

      {showConfig && (
        <div className="modal-overlay" onClick={() => setShowConfig(false)}>
          <div className="modal-content config-modal" onClick={e => e.stopPropagation()}>
            <h2>导出设置</h2>
            <div className="config-section">
              <label>中文字体</label>
              <select 
                value={exportConfig.mainFont.eastAsia}
                onChange={(e) => setExportConfig({
                  ...exportConfig,
                  mainFont: { ...exportConfig.mainFont, eastAsia: e.target.value }
                })}
              >
                <option value="SimSun">宋体 (SimSun)</option>
                <option value="SimHei">黑体 (SimHei)</option>
                <option value="Microsoft YaHei">微软雅黑 (Microsoft YaHei)</option>
                <option value="KaiTi">楷体 (KaiTi)</option>
                <option value="FangSong">仿宋 (FangSong)</option>
              </select>
            </div>
            
            <div className="setting-item">
                <label>英文字体：</label>
                <select 
                  value={exportConfig.mainFont.ascii}
                  onChange={(e) => setExportConfig({
                    ...exportConfig,
                    mainFont: { ...exportConfig.mainFont, ascii: e.target.value }
                  })}
                >
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Arial">Arial</option>
                  <option value="Calibri">Calibri</option>
                </select>
              </div>

              <div className="setting-item">
                <label>公式字体：</label>
                <select 
                  value={exportConfig.mathFont}
                  onChange={(e) => setExportConfig({
                    ...exportConfig,
                    mathFont: e.target.value
                  })}
                >
                  <option value="Times New Roman">Times New Roman (推荐)</option>
                  <option value="Cambria Math">Cambria Math (默认)</option>
                  <option value="XITS Math">XITS Math</option>
                  <option value="Latin Modern Math">Latin Modern Math</option>
                </select>
              </div>

              <div className="setting-item">
                <label>公式字号(pt)：</label>
                <input 
                  type="number" 
                  value={exportConfig.mathFontSize}
                  onChange={(e) => setExportConfig({
                    ...exportConfig,
                    mathFontSize: Number(e.target.value)
                  })}
                  min="8"
                  max="72"
                  step="0.5"
                />
              </div>

              <div className="setting-item">
                <label>行距：</label>
              <select 
                value={exportConfig.lineSpacing}
                onChange={(e) => setExportConfig({
                  ...exportConfig,
                  lineSpacing: parseFloat(e.target.value)
                })}
              >
                <option value="1.0">单倍行距 (1.0)</option>
                <option value="1.25">1.25倍行距</option>
                <option value="1.5">1.5倍行距 (默认)</option>
                <option value="2.0">2.0倍行距</option>
              </select>
            </div>

            <div className="config-section">
              <label>字体大小</label>
              <select 
                value={exportConfig.fontSize}
                onChange={(e) => setExportConfig({
                  ...exportConfig,
                  fontSize: parseFloat(e.target.value)
                })}
              >
                {FONT_SIZES.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button className="primary-btn" onClick={() => setShowConfig(false)}>确定</button>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>关于本工具</h2>
            <p>这是一个运行在浏览器端的 Markdown 转 Word 工具。</p>
            <ul>
              <li>支持标准 Markdown 语法</li>
              <li>支持 LaTeX 数学公式 (行内 $...$ 和 块级 $$...$$)</li>
              <li>生成的 Word 文档包含原生公式对象，可编辑</li>
              <li>纯前端运行，无需上传数据，安全快速</li>
              <li>适配中国网络环境</li>
            </ul>
            <button onClick={() => setShowAbout(false)}>关闭</button>
          </div>
        </div>
      )}

      {showAuthModal && (
        <AuthModal 
          onClose={() => setShowAuthModal(false)} 
          onSuccess={() => handleDownload()} 
          initialMessage={authModalMessage}
        />
      )}

      <main className="main-content">
        <div className="left-panel">
          <div className="toolbar">
            <button className="download-btn" onClick={handleDownload} disabled={isConverting}>
              {isConverting ? '转换中...' : '下载 Word'}
            </button>
            <button className="clear-btn" onClick={handleClear}>清空内容</button>
          </div>
          <div className="ios-tip" style={{fontSize: '12px', color: '#666', marginBottom: '10px', paddingRight: '5px', textAlign: 'right'}}>
             iOS用户提示: 若跳转预览页，请点击分享按钮选"存储到文件"
          </div>
          <textarea
            className="markdown-input"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="在此输入 Markdown 内容..."
          />
          <MathEditor onInsert={handleInsertMath} />
        </div>
        
        <div className="right-panel">
          <div className="preview-header">预览</div>
          <div className="markdown-preview">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex, rehypeRaw]}
            >
              {normalizeMarkdown(markdown)}
            </ReactMarkdown>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
