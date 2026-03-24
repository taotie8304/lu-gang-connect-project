// 鲁港通 - opencc-js 类型声明
declare module 'opencc-js' {
  interface ConverterOptions {
    from: 'cn' | 'tw' | 'hk' | 'jp' | 't';
    to: 'cn' | 'tw' | 'hk' | 'jp' | 't';
  }

  export function Converter(options: ConverterOptions): (text: string) => string;
  export function CustomConverter(dict: string[][]): (text: string) => string;
}
