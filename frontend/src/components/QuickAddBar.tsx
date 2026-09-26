import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, generateUUID } from "../api/client";
import { translations } from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { triggerHaptic } from "../telegram/telegram";
import { ShoppingItem } from "../types";
import { detectCategory, parseShoppingTextDeterministically } from "../utils/localParser";

export const QuickAddBar: React.FC = () => {
  const queryClient = useQueryClient();
  const isQuickAddOpen = useAppStore((s) => s.isQuickAddOpen);
  const closeQuickAdd = useAppStore((s) => s.closeQuickAdd);
  const openSheet = useAppStore((s) => s.openSheet);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const language = useAppStore((s) => s.language);
  const autoCategory = useAppStore((s) => s.autoCategory);
  const currency = useAppStore((s) => s.currency);

  const t = translations[language];
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus immediately upon opening (<16ms)
  useEffect(() => {
    if (isQuickAddOpen) {
      const timer = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setText("");
    }
  }, [isQuickAddOpen]);

  // Mutation with optimistic updates
  const addMutation = useMutation({
    mutationFn: async (rawInput: string) => {
      const trimmed = rawInput.trim();
      if (!trimmed) return [];

      let parsed = parseShoppingTextDeterministically(trimmed);
      if (!parsed || parsed.length === 0) {
        parsed = [
          {
            name: trimmed,
            quantity: 1,
            unit: "шт",
            category: autoCategory ? detectCategory(trimmed) : "Другое",
            estimated_price: null,
            confidence: 0.5,
          },
        ];
      }

      if (parsed.length === 1) {
        const p = parsed[0];
        const res = await api.createItem({
          name: p.name,
          quantity: p.quantity,
          unit: p.unit,
          category: autoCategory ? p.category : "Другое",
          price: p.estimated_price,
          currency_code: currency,
          raw_input_text: trimmed,
        });
        return [res];
      } else {
        const payloads = parsed.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          unit: p.unit,
          category: autoCategory ? p.category : "Другое",
          price: p.estimated_price,
          currency_code: currency,
          raw_input_text: trimmed,
        }));
        return await api.batchCreateItems(payloads);
      }
    },
    onMutate: async (rawInput: string) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previousItems = queryClient.getQueryData<ShoppingItem[]>(["items"]) || [];

      const trimmed = rawInput.trim();
      let parsed = parseShoppingTextDeterministically(trimmed);
      if (!parsed || parsed.length === 0) {
        parsed = [
          {
            name: trimmed,
            quantity: 1,
            unit: "шт",
            category: autoCategory ? detectCategory(trimmed) : "Другое",
            estimated_price: null,
            confidence: 0.5,
          },
        ];
      }

      const optimisticItems: ShoppingItem[] = parsed.map((p) => ({
        id: generateUUID(),
        user_id: "local_temp",
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        category: autoCategory ? p.category : "Другое",
        price: p.estimated_price,
        currency_code: currency,
        is_purchased: false,
        raw_input_text: trimmed,
        created_at: new Date().toISOString(),
        version: 1,
      }));

      queryClient.setQueryData<ShoppingItem[]>(["items"], (old = []) => [
        ...optimisticItems,
        ...old,
      ]);

      return { previousItems };
    },
    onError: (_err, _raw, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["items"], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = text.trim();
    if (!clean) return;

    if (hapticsEnabled) triggerHaptic("medium");
    addMutation.mutate(clean);
    setText("");
    // Close quick add after submitting
    closeQuickAdd();
  };

  const handleOpenDetails = () => {
    if (hapticsEnabled) triggerHaptic("light");
    const current = text.trim();
    closeQuickAdd();
    openSheet("quick", current);
  };

  if (!isQuickAddOpen) return null;

  return (
    <>
      {/* Tap backdrop to dismiss */}
      <div
        className="quick-add-backdrop"
        onClick={() => closeQuickAdd()}
        aria-hidden="true"
      />

      <aside
        className="quick-add-bar glass"
        role="region"
        aria-label="Быстрое добавление"
      >
        <form onSubmit={handleSubmit} className="quick-add-form">
          <input
            ref={inputRef}
            type="text"
            className="quick-add-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                closeQuickAdd();
              }
            }}
            placeholder={
              language === "uz"
                ? "Nima qo'shish kerak? ＋"
                : language === "en"
                ? "What to add? ＋"
                : "Что добавить? ＋"
            }
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            aria-label="Что добавить"
          />

          <div className="quick-add-actions">
            <button
              type="button"
              className="quick-add-details-btn"
              onClick={handleOpenDetails}
              title={language === "uz" ? "Batafsil" : language === "en" ? "Details" : "Подробнее"}
            >
              {language === "uz" ? "Batafsil" : language === "en" ? "Details" : "Подробнее"}
            </button>

            <button
              type="submit"
              className="quick-add-submit-btn"
              disabled={!text.trim()}
              aria-label={t.addBtn}
            >
              <svg viewBox="0 0 24 24" className="quick-add-icon">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </form>
      </aside>
    </>
  );
};
