#!/usr/bin/env python3
"""
Generate a single HTML file from all Markdown files with embedded images
and Lark video links.
"""

import os
import base64
import re
import markdown
from pathlib import Path

# Video URL mapping (local filename -> Lark URL)
VIDEO_URLS = {
    "00-login.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/KcPDbgJs8oWJbgxoeHJl9NTogkf",
    "01-register.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/H9D5bIkSKo7Xvwx9lU4lcPcYgxr",
    "02-resetpassword.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/BdCybHGSVoBA03xK65qlfsnegdh",
    "03-usermanagement.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/X8DAbKNbxoZ5aRxIAOZl6fgzgSf",
    "04-clientversions.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/MRhvbiwSuoLMkCxHL0tliJv5gkd",
    "05-gameworlds.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/T0O9bINraoRFHwxWDMrlzjhXgSu",
    "06-maintenance.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/IoSKbIW89oJZw1xltbylGDLVgnb",
    "07-apitokens.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/IPixbjZ1loJkhxxAXpnlhb7og28",
    "08-whitelists.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/QGMRbJ9f6o4saKxh1fclURuageh",
    "09-servicenotices.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/MRvWbrihboBCSaxCIKhlYwYtgkb",
    "10-ingamepopups.mp4": "https://nsgnr8m5arw6.sg.larksuite.com/file/YguXbLgZaoZHhIxALnblXWtggqc",
}

# Order of Markdown files to combine
MD_FILES_ORDER = [
    "00-table-of-contents.md",
    "01-introduction.md",
    "02-dashboard.md",
    "02-1-environments.md",
    "03-user-management.md",
    "04-client-versions.md",
    "05-game-worlds.md",
    "06-maintenance.md",
    "07-service-notices.md",
    "08-popup-notices.md",
    "09-coupons.md",
    "10-surveys.md",
    "11-store-products.md",
    "12-banners.md",
    "13-planning-data.md",
    "14-remote-config.md",
    "15-audit-logs.md",
    "16-api-tokens.md",
    "A-setup-guide.md",
]

def get_base64_image(image_path: str) -> str:
    """Convert image to base64 data URI."""
    if not os.path.exists(image_path):
        print(f"Warning: Image not found: {image_path}")
        return ""
    
    with open(image_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    
    # Determine MIME type
    ext = Path(image_path).suffix.lower()
    mime_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    mime = mime_types.get(ext, "image/png")
    
    return f"data:{mime};base64,{data}"

def get_base64_video(video_path: str) -> str:
    """Convert video to base64 data URI."""
    if not os.path.exists(video_path):
        print(f"Warning: Video not found: {video_path}")
        return ""
    
    file_size_mb = os.path.getsize(video_path) / 1024 / 1024
    print(f"  📹 Encoding video: {os.path.basename(video_path)} ({file_size_mb:.1f} MB)")
    
    with open(video_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    
    return f"data:video/mp4;base64,{data}"

def replace_images_with_base64(content: str, base_dir: str) -> str:
    """Replace image paths with base64 data URIs."""
    # Match ![alt](path) pattern
    img_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
    
    def replace_img(match):
        alt = match.group(1)
        path = match.group(2)
        
        # Handle relative paths
        if path.startswith("images/"):
            full_path = os.path.join(base_dir, path)
        else:
            full_path = os.path.join(base_dir, "images", path)
        
        base64_data = get_base64_image(full_path)
        if base64_data:
            return f'![{alt}]({base64_data})'
        return match.group(0)
    
    return re.sub(img_pattern, replace_img, content)

def replace_video_tags(content: str, base_dir: str) -> str:
    """Replace <video> tags with Lark links."""
    # Match <video>...</video> pattern
    video_pattern = r'<video[^>]*>.*?<source[^>]*src="videos/([^"]+)"[^>]*>.*?</video>'
    
    def replace_video(match):
        video_file = match.group(1)
        lark_url = VIDEO_URLS.get(video_file, "")
        
        if lark_url:
            # Create a styled link to the video (Flat Design)
            return f'''
<div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-left: 4px solid #2196F3; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left;">
  <div style="display: flex; align-items: center;">
    <span style="font-size: 24px; margin-right: 15px;">🎬</span>
    <div>
      <a href="{lark_url}" target="_blank" style="color: #2196F3; text-decoration: none; font-size: 18px; font-weight: 600;">
        동영상 보기: {video_file.replace('.mp4', '')}
      </a>
      <p style="color: #6c757d; margin: 5px 0 0 0; font-size: 14px;">클릭하여 새 창에서 재생하세요.</p>
    </div>
  </div>
</div>
'''
        return f'<p>📹 동영상: {video_file}</p>'
    
    return re.sub(video_pattern, replace_video, content, flags=re.DOTALL)

def replace_video_links(content: str) -> str:
    """Replace markdown video links with Lark links."""
    # Match [text](videos/xxx.mp4) pattern
    link_pattern = r'\[([^\]]+)\]\(videos/([^)]+\.mp4)\)'
    
    def replace_link(match):
        text = match.group(1)
        video_file = match.group(2)
        lark_url = VIDEO_URLS.get(video_file, "")
        
        if lark_url:
            return f'[{text}]({lark_url})'
        return match.group(0)
    
    return re.sub(link_pattern, replace_link, content)

# Mapping of md files to anchor IDs (must match generated heading IDs)
MD_TO_ANCHOR = {
    "00-table-of-contents.md": "#gatrix-운영자-매뉴얼",
    "01-introduction.md": "#제-1장-소개-introduction",
    "02-dashboard.md": "#제-2장-대시보드-개요-dashboard-overview",
    "02-1-environments.md": "#제-2-1장-환경-관리-environment-management",
    "03-user-management.md": "#제-3장-사용자-관리-user-management",
    "04-client-versions.md": "#제-4장-클라이언트-버전-관리-client-version-management",
    "05-game-worlds.md": "#제-5장-게임-월드-관리-game-world-management",
    "06-maintenance.md": "#제-6장-점검-관리-maintenance-management",
    "07-service-notices.md": "#제-7장-공지사항-관리-service-notices",
    "08-popup-notices.md": "#제-8장-인게임-팝업-관리-ingame-popup-notices",
    "09-coupons.md": "#제-9장-쿠폰-관리-coupon-management",
    "10-surveys.md": "#제-10장-설문조사-관리-surveys",
    "11-store-products.md": "#제-12장-상점-상품-관리-store-products",
    "12-banners.md": "#제-12장-배너-관리-banner-management",
    "13-planning-data.md": "#제-13장-기획-데이터-관리-planning-data",
    "14-remote-config.md": "#제-14장-리모트-컨피그-remote-config",
    "15-audit-logs.md": "#제-15장-감사-로그-audit-logs",
    "16-api-tokens.md": "#제-16장-api-토큰-관리-api-access-tokens",
    "A-setup-guide.md": "#부록-a-시스템-설정-가이드-system-setup",
}

def replace_md_links(content: str) -> str:
    """Replace .md file links with anchor links."""
    # Match [text](filename.md) pattern
    link_pattern = r'\[([^\]]+)\]\(([^)]+\.md)\)'
    
    def replace_link(match):
        text = match.group(1)
        md_file = match.group(2)
        
        anchor = MD_TO_ANCHOR.get(md_file, "")
        if anchor:
            return f'[{text}]({anchor})'
        return match.group(0)
    
    return re.sub(link_pattern, replace_link, content)

def generate_html():
    """Generate the complete HTML file."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Combine all markdown content
    all_content = []
    
    for md_file in MD_FILES_ORDER:
        file_path = os.path.join(base_dir, md_file)
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Replace images with base64
            content = replace_images_with_base64(content, base_dir)
            
            # Replace video tags with embedded base64 videos
            content = replace_video_tags(content, base_dir)
            
            # Replace video markdown links
            content = replace_video_links(content)
            
            # Replace .md file links with anchor links
            content = replace_md_links(content)
            
            # Add page break before each chapter (except TOC)
            if md_file != "00-table-of-contents.md":
                all_content.append('<div class="page-break"></div>')
            
            all_content.append(content)
            all_content.append("\n\n---\n\n")
            print(f"✓ Processed: {md_file}")
        else:
            print(f"✗ Not found: {md_file}")
    
    combined_md = "\n".join(all_content)
    
    # Convert to HTML with extensions
    md_extensions = [
        'tables', 
        'fenced_code', 
        'toc',
        'nl2br',
        'attr_list',
    ]
    
    # Extension configuration - enable automatic heading IDs
    extension_configs = {
        'toc': {
            'slugify': lambda value, separator: re.sub(r'[^\w\-]', '', value.lower().replace(' ', separator)),
            'toc_depth': '1-3',
        }
    }
    
    html_content = markdown.markdown(
        combined_md, 
        extensions=md_extensions,
        extension_configs=extension_configs
    )
    
    # Full HTML template with GitHub style
    html_template = f'''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gatrix 운영자 매뉴얼</title>
    <style>
        /* GitHub Style Theme */
        :root {{
            --color-fg-default: #1f2328;
            --color-fg-muted: #656d76;
            --color-fg-subtle: #6e7781;
            --color-canvas-default: #ffffff;
            --color-canvas-subtle: #f6f8fa;
            --color-border-default: #d0d7de;
            --color-border-muted: #d8dee4;
            --color-accent-fg: #0969da;
            --color-accent-emphasis: #0969da;
            --color-success-fg: #1a7f37;
            --color-attention-fg: #9a6700;
            --color-danger-fg: #d1242f;
            --color-done-fg: #8250df;
        }}
        
        * {{
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
            font-size: 16px;
            line-height: 1.6;
            color: var(--color-fg-default);
            background-color: var(--color-canvas-default);
            margin: 0;
            padding: 20px;
            word-wrap: break-word;
        }}
        
        .container {{
            max-width: 980px;
            margin: 0 auto;
            background: var(--color-canvas-default);
            padding: 45px;
            border: 1px solid var(--color-border-default);
            border-radius: 6px;
        }}
        
        /* Headings */
        h1, h2, h3, h4, h5, h6 {{
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }}
        
        h1 {{
            font-size: 2em;
            padding-bottom: 0.3em;
            border-bottom: 1px solid var(--color-border-muted);
        }}
        
        h1:first-child {{
            margin-top: 0;
        }}
        
        h2 {{
            font-size: 1.5em;
            padding-bottom: 0.3em;
            border-bottom: 1px solid var(--color-border-muted);
        }}
        
        h3 {{
            font-size: 1.25em;
        }}
        
        h4 {{
            font-size: 1em;
        }}
        
        h5 {{
            font-size: 0.875em;
        }}
        
        h6 {{
            font-size: 0.85em;
            color: var(--color-fg-muted);
        }}
        
        /* Paragraphs and text */
        p {{
            margin-top: 0;
            margin-bottom: 16px;
        }}
        
        /* Links */
        a {{
            color: var(--color-accent-fg);
            text-decoration: none;
        }}
        
        a:hover {{
            text-decoration: underline;
        }}
        
        /* Lists */
        ul, ol {{
            padding-left: 2em;
            margin-top: 0;
            margin-bottom: 16px;
        }}
        
        li {{
            margin-top: 0.25em;
        }}
        
        li + li {{
            margin-top: 0.25em;
        }}
        
        /* Tables */
        table {{
            width: 100%;
            border-spacing: 0;
            border-collapse: collapse;
            margin-top: 0;
            margin-bottom: 16px;
            display: block;
            overflow: auto;
        }}
        
        th, td {{
            padding: 6px 13px;
            border: 1px solid var(--color-border-default);
        }}
        
        th {{
            font-weight: 600;
            background-color: var(--color-canvas-subtle);
        }}
        
        tr {{
            background-color: var(--color-canvas-default);
            border-top: 1px solid var(--color-border-muted);
        }}
        
        tr:nth-child(2n) {{
            background-color: var(--color-canvas-subtle);
        }}
        
        /* Code */
        code {{
            padding: 0.2em 0.4em;
            margin: 0;
            font-size: 85%;
            white-space: break-spaces;
            background-color: rgba(175, 184, 193, 0.2);
            border-radius: 6px;
            font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
        }}
        
        pre {{
            padding: 16px;
            overflow: auto;
            font-size: 85%;
            line-height: 1.45;
            color: var(--color-fg-default);
            background-color: var(--color-canvas-subtle);
            border-radius: 6px;
            margin-top: 0;
            margin-bottom: 16px;
        }}
        
        pre code {{
            padding: 0;
            margin: 0;
            overflow: visible;
            font-size: 100%;
            line-height: inherit;
            word-wrap: normal;
            background-color: transparent;
            border: 0;
        }}
        
        /* Mermaid diagram container */
        pre.mermaid {{
            background: var(--color-canvas-default);
            padding: 20px;
            text-align: center;
            border: 1px solid var(--color-border-default);
        }}
        
        .mermaid {{
            background: var(--color-canvas-default) !important;
        }}
        
        /* Blockquote */
        blockquote {{
            margin: 0 0 16px 0;
            padding: 0 1em;
            color: var(--color-fg-muted);
            border-left: 0.25em solid var(--color-border-default);
        }}
        
        blockquote > :first-child {{
            margin-top: 0;
        }}
        
        blockquote > :last-child {{
            margin-bottom: 0;
        }}
        
        /* Images */
        img {{
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            border: 1px solid var(--color-border-default);
            margin: 16px 0;
            display: block;
        }}
        
        /* Horizontal rule */
        hr {{
            height: 0.25em;
            padding: 0;
            margin: 24px 0;
            background-color: var(--color-border-default);
            border: 0;
        }}
        
        /* Page break for printing */
        .page-break {{
            page-break-before: always;
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid var(--color-border-muted);
        }}
        
        /* Print styles */
        @media print {{
            body {{
                background: white;
                padding: 0;
            }}
            .container {{
                border: none;
                padding: 20px;
            }}
            .page-break {{
                page-break-before: always;
            }}
        }}
        
        /* Note/Warning boxes (GitHub style alerts) */
        blockquote p:first-child strong {{
            display: inline-block;
        }}
        
        /* Korean font support */
        @font-face {{
            font-family: 'Noto Sans KR';
            font-style: normal;
            font-weight: 400;
            src: url(https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLTq8H4hfeE.woff2) format('woff2');
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', Helvetica, Arial, sans-serif;
        }}
    </style>
    <!-- Mermaid.js for diagram rendering -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
    <div class="container">
        {html_content}
    </div>
    
    <script>
        // Initialize Mermaid
        mermaid.initialize({{
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: {{
                useMaxWidth: true,
                htmlLabels: true
            }}
        }});
        
        // Convert code blocks with language-mermaid to mermaid divs
        document.querySelectorAll('code.language-mermaid').forEach(function(codeEl) {{
            var pre = codeEl.parentElement;
            var mermaidDiv = document.createElement('pre');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.textContent = codeEl.textContent;
            pre.parentNode.replaceChild(mermaidDiv, pre);
        }});
        
        // Re-render mermaid after DOM manipulation
        setTimeout(function() {{
            mermaid.init(undefined, '.mermaid');
        }}, 100);
    </script>
</body>
</html>
'''
    
    # Write output
    output_path = os.path.join(base_dir, "Gatrix_Manual_Complete.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_template)
    
    print(f"\n✅ Generated: {output_path}")
    print(f"   File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    generate_html()
