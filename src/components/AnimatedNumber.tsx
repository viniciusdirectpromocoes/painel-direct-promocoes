import { useEffect, useRef, useState } from "react";

type Props = { value: number; format: (n: number) => string; duration?: number };

/** Conta de forma suave do valor anterior até o novo. Sem animação se o sistema pedir movimento reduzido. */
export function AnimatedNumber({ value, format, duration = 700 }: Props) {
  const [atual, setAtual] = useState(value);
  const anterior = useRef(value);

  useEffect(() => {
    const de = anterior.current;
    const para = value;
    anterior.current = value;

    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir || de === para) {
      setAtual(para);
      return;
    }

    let frame = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setAtual(de + (para - de) * eased);
      if (p < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{format(atual)}</>;
}
