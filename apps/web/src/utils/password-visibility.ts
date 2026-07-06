export function passwordInputType(isVisible: boolean): 'password' | 'text' {
  return isVisible ? 'text' : 'password';
}

export function passwordToggleLabel(isVisible: boolean): string {
  return isVisible ? '隐藏密码' : '显示密码';
}
