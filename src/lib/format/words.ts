export function amountInWords(num: number): string {
  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  if (num === 0) return "Zero";

  function g(n: number): string {
    if (n < 20) return a[n];
    const d = n % 10;
    return b[Math.floor(n / 10)] + (d ? "-" + a[d] : "");
  }

  function h(n: number): string {
    if (n < 100) return g(n);
    const d = n % 100;
    return a[Math.floor(n / 100)] + " hundred" + (d ? " and " + g(d) : "");
  }

  function convert(n: number): string {
    if (n < 1000) return h(n);
    if (n < 100000) {
      const thousands = Math.floor(n / 1000);
      const rem = n % 1000;
      return h(thousands) + " thousand" + (rem ? " " + h(rem) : "");
    }
    if (n < 10000000) {
      const lakhs = Math.floor(n / 100000);
      const rem = n % 100000;
      return h(lakhs) + " lakh" + (rem ? " " + convert(rem) : "");
    }
    const crores = Math.floor(n / 10000000);
    const rem = n % 10000000;
    return convert(crores) + " crore" + (rem ? " " + convert(rem) : "");
  }

  const intPart = Math.floor(num);
  const words = convert(intPart);
  return (words.charAt(0).toUpperCase() + words.slice(1) + " Rupees Only")
    .replace(/\s+/g, " ")
    .trim();
}
