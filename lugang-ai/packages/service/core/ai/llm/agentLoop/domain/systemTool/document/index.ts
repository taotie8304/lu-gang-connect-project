// 鲁港通 - 文档操作工具（第二批：生成；第三批：读取与编辑）：
// 任何端都可用，产物上传到对话文件目录，由聊天里的下载卡片交付（默认保留 3 天）。
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool
} from '@fastgpt/global/core/ai/llm/type';
import { parseJsonArgs } from '../../../../../utils';
import type { AgentLoopUsage } from '../../usage';
import {
  DOCUMENT_GENERATE_FORMATS,
  DocumentOperationArgsSchema,
  SLIDE_LAYOUTS
} from './schema';
import type { DocumentOperationArgs } from './schema';

export const DOCUMENT_OPERATION_TOOL_NAME = 'document_operation';

export const DOCUMENT_OPERATION_ACTIONS = ['read', 'generate', 'edit'] as const;

export type DocumentOperationParseResult =
  | { success: true; args: DocumentOperationArgs }
  | { success: false; error: string };

export type AgentLoopDocumentExecuteParams = {
  call: ChatCompletionMessageToolCall;
  messages: ChatCompletionMessageParam[];
};

export type AgentLoopDocumentExecutionResult = {
  response: string;
  usages: AgentLoopUsage[];
  metadata?: unknown;
  error?: unknown;
};

export type AgentLoopDocumentExecutor = (
  params: AgentLoopDocumentExecuteParams
) => Promise<AgentLoopDocumentExecutionResult>;

const DOCUMENT_OPERATION_DESCRIPTION =
  '生成、读取和修改文档文件。产物保存在本次对话的文件目录里，由聊天的下载卡片交付，默认保留 3 天内可重复下载。用户要 Word、Excel、PDF、PPT 或 Markdown 文件时用 generate：format 选 docx/xlsx/pdf/md/pptx，fileName 不含扩展名；Word/PDF/Markdown 用 blocks 按顺序组织多级标题、正文段落、列表、表格、分隔线、分页（只有一两段简单内容时才用 content 纯文本，md 也可直接用 content 写原文），Excel 用 sheets 组织最多 5 个工作表（表头会自动加粗并冻结，可指定合并单元格、列宽，单元格以 = 开头会写成公式），PPT 用 slides 组织最多 30 页（每页用 layout 选版式：cover 封面、section 章节、bullets 要点、image 图文、table 表格、chart 图表；图文页的图片只能取本次对话文件清单里的地址；可选演讲者备注）。要修改本次对话里的已有文件时，先 read 读取提纲，再按提纲用 edit 提交修改；sourceUrl 只能取对话文件清单里的地址，不得编造，也不能用本机路径。编辑一律另存为新文件，不覆盖原件。编辑可以替换文字或图片清单里的已有图片、删除页、调整页序，不能新增页、插入全新图片、改版式或主题色，扫描件也不能改稿；受限于格式能力时应直接说明并给出替代方案。不要声称「已发送邮件」「已同步网盘」等未发生的行为；交付方式只有下载卡片。';

export const createDocumentOperationTool = (): ChatCompletionTool => ({
  type: 'function',
  function: {
    name: DOCUMENT_OPERATION_TOOL_NAME,
    description: DOCUMENT_OPERATION_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [...DOCUMENT_OPERATION_ACTIONS],
          description: '要执行的动作：read 读取提纲、generate 生成新文件、edit 修改已有文件'
        },
        sourceUrl: {
          type: 'string',
          description:
            'read / edit 的源文件地址，必须来自本次对话的文件清单（http/https），不得编造'
        },
        format: {
          type: 'string',
          enum: [...DOCUMENT_GENERATE_FORMATS],
          description: 'generate 要生成的文件格式：docx 为 Word、xlsx 为 Excel、pdf、md 为 Markdown、pptx 为 PPT'
        },
        fileName: {
          type: 'string',
          description: 'generate 的文件名（不含扩展名），最多 80 字'
        },
        title: {
          type: 'string',
          description: 'generate 的文档标题，最多 120 字'
        },
        content: {
          type: 'string',
          description:
            'generate 的纯文本内容，最多 12000 字；docx/pdf/md 内容简单时使用，md 也可直接写 Markdown 原文'
        },
        blocks: {
          type: 'array',
          description:
            'generate 生成 Word/PDF/Markdown 的结构化内容，按数组顺序排版，最多 120 块；文档较长时优先使用',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['heading', 'paragraph', 'list', 'table', 'divider', 'pageBreak'],
                description:
                  '块类型：heading 标题、paragraph 正文段落、list 列表、table 表格、divider 分隔线、pageBreak 另起一页'
              },
              level: {
                type: 'number',
                description: 'heading 的层级，1 到 3，默认 1'
              },
              text: {
                type: 'string',
                description: 'heading 或 paragraph 的文字内容'
              },
              ordered: {
                type: 'boolean',
                description: 'list 是否为有序列表，默认无序'
              },
              items: {
                type: 'array',
                items: { type: 'string' },
                description: 'list 的条目'
              },
              header: {
                type: 'array',
                items: { type: 'string' },
                description: 'table 的表头，最多 12 列'
              },
              rows: {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'string' }
                },
                description: 'table 的数据行，最多 200 行、12 列'
              }
            },
            required: ['type']
          }
        },
        sheets: {
          type: 'array',
          description:
            'generate 生成 Excel 时的工作表，最多 5 个，数据行合计最多 200 行；一个文件有多张表时使用',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: '工作表名称，最多 31 字，例如「人员名单」'
              },
              header: {
                type: 'array',
                items: { type: 'string' },
                description: '表头行，最多 12 列，会自动加粗并冻结'
              },
              rows: {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'string' }
                },
                description: '数据行，每个单元格最多 200 字；以 = 开头会写成公式'
              },
              merges: {
                type: 'array',
                items: { type: 'string' },
                description: '要合并的单元格范围，例如 ["A1:B2"]，最多 30 个'
              },
              widths: {
                type: 'array',
                items: { type: 'number' },
                description: '各列宽度（字符数，6 到 80），不填自动适应内容'
              },
              freeze: {
                type: 'boolean',
                description: '是否冻结表头，默认在提供表头时冻结'
              }
            }
          }
        },
        slides: {
          type: 'array',
          description:
            'generate 生成 PPT 时的幻灯片，最多 30 页，按数组顺序排列；每页用 layout 选版式',
          items: {
            type: 'object',
            properties: {
              layout: {
                type: 'string',
                enum: [...SLIDE_LAYOUTS],
                description:
                  '版式：cover 封面、section 章节、bullets 要点（默认）、image 图文、table 表格、chart 图表'
              },
              title: {
                type: 'string',
                description: '该页标题，最多 120 字'
              },
              subtitle: {
                type: 'string',
                description: '封面或章节页的副标题，最多 200 字'
              },
              bullets: {
                type: 'array',
                items: { type: 'string' },
                description: '该页要点，最多 6 条，每条最多 300 字'
              },
              image: {
                type: 'object',
                description: 'layout 为 image 时的图片：只能取本次对话文件清单里的地址',
                properties: {
                  sourceUrl: {
                    type: 'string',
                    description: '对话文件清单里的图片地址（http/https），不得编造'
                  },
                  caption: {
                    type: 'string',
                    description: '图片说明，最多 200 字'
                  }
                },
                required: ['sourceUrl']
              },
              table: {
                type: 'object',
                description: 'layout 为 table 时的表格：最多 8 行 6 列',
                properties: {
                  header: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '表头，最多 6 列，每格最多 80 字'
                  },
                  rows: {
                    type: 'array',
                    items: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    description: '数据行，最多 8 行，每行列数需与表头一致'
                  }
                },
                required: ['header', 'rows']
              },
              chart: {
                type: 'object',
                description: 'layout 为 chart 时的图表：柱状、折线或饼图，最多 3 个系列',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['bar', 'line', 'pie'],
                    description: '图表类型：bar 柱状、line 折线、pie 饼图（饼图只能一组数据）'
                  },
                  categories: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '分类标签，最多 12 个，每个最多 30 字'
                  },
                  series: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: '系列名称，最多 30 字' },
                        values: {
                          type: 'array',
                          items: { type: 'number' },
                          description: '数值，个数要与分类数量一致'
                        }
                      },
                      required: ['name', 'values']
                    },
                    description: '数据系列，最多 3 个'
                  }
                },
                required: ['type', 'categories', 'series']
              },
              notes: {
                type: 'string',
                description: '演讲者备注，最多 2000 字'
              }
            },
            required: ['title']
          }
        },
        outputName: {
          type: 'string',
          description: 'edit 的输出文件名（不含扩展名），最多 80 字；不填则使用「原名（修改版）」'
        },
        operations: {
          type: 'array',
          description:
            'edit 的修改清单，按数组顺序执行，最多 60 条；替换/改写合计最多 50 处、插入追加最多 20 段、Excel 单元格合计最多 200 个、PDF 填写最多 40 项、PPT 删页与调序合计最多 30 条，超出请分次修改。段落序号、表格序号与工作表名称来自 read 返回的提纲',
          items: {
            type: 'object',
            properties: {
              op: {
                type: 'string',
                enum: [
                  'replace_text',
                  'set_paragraph',
                  'insert_paragraph',
                  'append_paragraph',
                  'set_table_cell',
                  'set_cell',
                  'append_row',
                  'fill_field',
                  'add_text',
                  'replace_image',
                  'delete_slide',
                  'move_slide'
                ],
                description:
                  '操作类型：replace_text 替换文字（可限定段落、工作表或幻灯片）、set_paragraph 整段改写、insert_paragraph 在某段后插入、append_paragraph 文末追加、set_table_cell 改 Word 表格单元格、set_cell 改 Excel 单元格、append_row 工作表追加一行、fill_field 填写 PDF 表单字段、add_text 在 PDF 标签旁叠加文字、replace_image 替换 PPT 里的已有图片、delete_slide 删除 PPT 页、move_slide 调整 PPT 页序'
              },
              find: {
                type: 'string',
                description: 'replace_text 要查找的原文，最多 200 字，必须与文件中完全一致'
              },
              replace: {
                type: 'string',
                description: 'replace_text 替换后的文字，最多 600 字；留空表示删除查找到的文字'
              },
              paragraph: {
                type: 'number',
                description: '段落序号（0 开始，来自 read）；replace_text 限定范围时可选'
              },
              sheet: {
                type: 'string',
                description: '工作表名称；replace_text 限定范围时可选，最多 31 字'
              },
              slide: {
                type: 'number',
                description:
                  '幻灯片页码（从 1 开始）；replace_text 限定范围时可选，delete_slide 时必填'
              },
              image: {
                type: 'string',
                description:
                  'replace_image 要替换的图片文件名，来自 read 返回的图片清单，例如 image1.png；不能带路径'
              },
              sourceUrl: {
                type: 'string',
                description:
                  'replace_image 的新图片地址，只能取本次对话文件清单里的 http(s) 地址'
              },
              from: {
                type: 'number',
                description: 'move_slide 要移动的幻灯片页码（从 1 开始）'
              },
              to: {
                type: 'number',
                description: 'move_slide 移动后的目标页码（从 1 开始）'
              },
              after: {
                type: 'number',
                description: 'insert_paragraph 在其后插入的段落序号（0 开始）'
              },
              text: {
                type: 'string',
                description:
                  'set_paragraph / insert_paragraph / append_paragraph 的段落文字，最多 4000 字；set_table_cell 时的单元格文字，最多 2000 字'
              },
              table: {
                type: 'number',
                description: 'set_table_cell 的表格序号（0 开始，来自 read 的表格清单）'
              },
              row: {
                type: 'number',
                description: 'set_table_cell 的行号（0 开始），表头行是 0'
              },
              cell: {
                anyOf: [{ type: 'number' }, { type: 'string' }],
                description:
                  'set_table_cell 时是列号（0 开始）；set_cell 时是 Excel 单元格地址字符串，例如 B2'
              },
              value: {
                type: 'string',
                description:
                  'set_cell 要写入的值，最多 2000 字；fill_field / add_text 要填写的内容，最多 600 字'
              },
              values: {
                type: 'array',
                items: { type: 'string' },
                description: 'append_row 追加一行各列的值，最多 50 列，每个单元格最多 2000 字'
              },
              label: {
                type: 'string',
                description:
                  'fill_field / add_text 的标签文字，与 read 返回的 PDF 提纲里的字段名一致，最多 120 字'
              }
            },
            required: ['op']
          }
        }
      },
      required: ['action']
    }
  }
});

const isSupportedAction = (action: unknown): action is (typeof DOCUMENT_OPERATION_ACTIONS)[number] =>
  typeof action === 'string' &&
  (DOCUMENT_OPERATION_ACTIONS as readonly string[]).includes(action);

/**
 * 鲁港通 - 解析模型给出的文档工具参数；不支持的 action 单独给中文提示，避免只看笼统 Zod 报错。
 */
export const parseDocumentOperationArgs = (raw: unknown): DocumentOperationParseResult => {
  const parsed = typeof raw === 'string' ? parseJsonArgs<Record<string, unknown>>(raw) : raw;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      success: false,
      error: '文档操作参数格式不正确，需要提供包含 action 的 JSON 对象。'
    };
  }

  const action = (parsed as { action?: unknown }).action;
  if (!isSupportedAction(action)) {
    return {
      success: false,
      error: `不支持的文档操作：${typeof action === 'string' ? action : '未知'}。仅支持 read/generate/edit。`
    };
  }

  const result = DocumentOperationArgsSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((issue) => issue.message).join('；')
    };
  }

  return { success: true, args: result.data };
};

export { DOCUMENT_GENERATE_FORMATS, DocumentOperationArgsSchema } from './schema';

export type {
  DocumentEditArgs,
  DocumentEditOperation,
  DocumentGenerateArgs,
  DocumentOperationArgs,
  DocumentReadArgs,
  GeneratedSlide
} from './schema';
