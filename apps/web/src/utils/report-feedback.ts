export type ReportNoticeState = 'idle' | 'generating' | 'completed';

export interface ReportNotice {
  tone: 'info' | 'success';
  title: string;
  message: string;
}

export function reportActionText(isGenerating: boolean): string {
  return isGenerating ? '正在生成报告...' : '生成综合评估报告';
}

export function reportNotice(state: ReportNoticeState): ReportNotice | null {
  if (state === 'generating') {
    return {
      tone: 'info',
      title: '报告生成中',
      message: '系统正在汇总匹配结果、建议动作和申报风险，请稍候。'
    };
  }
  if (state === 'completed') {
    return {
      tone: 'success',
      title: '报告已生成',
      message: '综合评估报告已更新到下方报告区，可查看申报优先级、材料清单和风险限制。'
    };
  }
  return null;
}
