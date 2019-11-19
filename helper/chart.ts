export class ChartHelper {
  public static bar = (value: number, maxValue: number, maxBarLength: number) => {
    const fractions: string[] = ['▏', '▎', '▍', '▋', '▊', '▉'];
    const barLength: number = value * maxBarLength / maxValue;
    const wholeNumberPart: number = Math.floor(barLength);
    const fractionalPart: number = barLength - wholeNumberPart;
    let bar: string = fractions[fractions.length - 1].repeat(wholeNumberPart);
    if (fractionalPart > 0)
      bar += fractions[Math.floor(fractionalPart * fractions.length)];
    return bar;
  }

  public static chart = (data: any, showValue: boolean = false, maxBarLength: number = 100, sort: boolean = true, postValue: string = '') => {
    const formatted: any[] = Object.keys(data).map(key => ({ key: key, value: data[key] }));
    const sorted: any[] = !sort ? formatted : formatted.sort((a, b) => b.value - a.value);
    const maxValue: number = Math.max(...sorted.map(item => item.value));
    const maxKeyNameLength: number = Math.max(...sorted.map(item => item.key.length));
    return sorted.map(item => {
      const prefix: string = item.key + " ".repeat(maxKeyNameLength - item.key.length + 1);
      const barText: string = ChartHelper.bar(item.value, maxValue, maxBarLength);
      const suffix: string = showValue ? ` ${item.value}${postValue}` : "";
      return prefix + barText + suffix;
    }).join('\n');
  }

}