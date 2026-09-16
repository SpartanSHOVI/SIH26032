'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { languageByCode, SUPPORTED_LANGUAGES } from '../utils/i18n';

export const storageKey = 'annsetu_language';
export const cachePrefix = 'annsetu_translation_cache_v2';
export const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'SVG']);

type TranslationContextValue = {
  language: string;
  languageInfo: ReturnType<typeof languageByCode>;
  setLanguage: (code: string) => void;
  translating: boolean;
};

const TranslationContext = createContext<TranslationContextValue | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState('en');
  const [translating, setTranslating] = useState(false);
  const originals = useRef(new WeakMap<Text, string>());
  const originalsAttr = useRef(new WeakMap<Element, { placeholder?: string; title?: string; ariaLabel?: string }>());
  const running = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const isMutatingDOM = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved && SUPPORTED_LANGUAGES.some((item) => item.code === saved)) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = useCallback((code: string) => {
    if (!SUPPORTED_LANGUAGES.some((item) => item.code === code)) return;
    localStorage.setItem(storageKey, code);
    setLanguageState(code);
  }, []);

  const translatePage = useCallback(async () => {
    if (running.current || typeof document === 'undefined') return;
    running.current = true;
    setTranslating(true);

    try {
      const targetLanguage = languageByCode(language).translationCode ?? language;

      // 1. Gather all translatable text nodes
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || ignoredTags.has(parent.tagName) || parent.closest('[data-no-translate]') || parent.closest('.no-translate')) {
            return NodeFilter.FILTER_REJECT;
          }
          const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
          if (text.length < 2 || /^[\d\s.,:;()[\]#/+%₹-]+$/.test(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);

      // 2. Gather translatable elements with attributes (placeholder, title, aria-label)
      const attrElements: Array<{ el: Element; attr: 'placeholder' | 'title' | 'ariaLabel'; original: string }> = [];
      const candidateElements = document.querySelectorAll<HTMLElement>('input[placeholder], textarea[placeholder], [title], [aria-label]');

      candidateElements.forEach((el) => {
        if (el.closest('[data-no-translate]') || el.closest('.no-translate')) return;

        const placeholder = el.getAttribute('placeholder')?.trim();
        if (placeholder && placeholder.length >= 2 && !/^[\d\s.,:;()[\]#/+%₹-]+$/.test(placeholder)) {
          if (!originalsAttr.current.has(el)) {
            originalsAttr.current.set(el, { ...originalsAttr.current.get(el), placeholder: el.getAttribute('placeholder') || '' });
          }
          const orig = originalsAttr.current.get(el)?.placeholder || placeholder;
          attrElements.push({ el, attr: 'placeholder', original: orig });
        }

        const title = el.getAttribute('title')?.trim();
        if (title && title.length >= 2 && !/^[\d\s.,:;()[\]#/+%₹-]+$/.test(title)) {
          if (!originalsAttr.current.has(el)) {
            originalsAttr.current.set(el, { ...originalsAttr.current.get(el), title: el.getAttribute('title') || '' });
          }
          const orig = originalsAttr.current.get(el)?.title || title;
          attrElements.push({ el, attr: 'title', original: orig });
        }
      });

      // If returning to English, restore all original text and attributes
      if (targetLanguage === 'en') {
        isMutatingDOM.current = true;
        for (const node of nodes) {
          const original = originals.current.get(node);
          if (original !== undefined) node.textContent = original;
        }
        for (const item of attrElements) {
          const orig = item.attr === 'placeholder'
            ? originalsAttr.current.get(item.el)?.placeholder
            : originalsAttr.current.get(item.el)?.title;
          if (orig !== undefined) {
            item.el.setAttribute(item.attr === 'placeholder' ? 'placeholder' : 'title', orig);
          }
        }
        setTimeout(() => {
          isMutatingDOM.current = false;
        }, 50);
        return;
      }

      // Collect all phrases that need translation
      const missing: string[] = [];
      const uniqueMissing = new Set<string>();

      for (const node of nodes) {
        const raw = node.textContent ?? '';
        if (!originals.current.has(node)) {
          originals.current.set(node, raw);
        }
        const originalText = (originals.current.get(node) ?? raw).replace(/\s+/g, ' ').trim();
        const key = cacheKey(targetLanguage, originalText);
        if (!localStorage.getItem(key) && !uniqueMissing.has(originalText)) {
          uniqueMissing.add(originalText);
          missing.push(originalText);
        }
      }

      for (const item of attrElements) {
        const originalText = item.original.replace(/\s+/g, ' ').trim();
        const key = cacheKey(targetLanguage, originalText);
        if (!localStorage.getItem(key) && !uniqueMissing.has(originalText)) {
          uniqueMissing.add(originalText);
          missing.push(originalText);
        }
      }

      // Translate in batches of 50
      const batchSize = 50;
      for (let i = 0; i < missing.length; i += batchSize) {
        const batch = missing.slice(i, i + batchSize);
        if (!batch.length) continue;
        try {
          const response = await api.post('/translate', { source: 'en', target: targetLanguage, texts: batch });
          const translated = response.data?.translations as string[];
          if (Array.isArray(translated)) {
            batch.forEach((text, index) => {
              const trans = translated[index];
              if (trans && trans.trim() && trans.trim().toLowerCase() !== text.trim().toLowerCase()) {
                localStorage.setItem(cacheKey(targetLanguage, text), trans);
              }
            });
          }
        } catch {
          // Keep original text on network error
        }
      }

      // Apply translations to DOM
      isMutatingDOM.current = true;

      // 1. Text nodes (preserve whitespace)
      for (const node of nodes) {
        const fullOriginal = originals.current.get(node) ?? node.textContent ?? '';
        const trimmedOriginal = fullOriginal.replace(/\s+/g, ' ').trim();
        const translated = localStorage.getItem(cacheKey(targetLanguage, trimmedOriginal));
        if (translated) {
          const leadWs = fullOriginal.match(/^\s*/)?.[0] ?? '';
          const trailWs = fullOriginal.match(/\s*$/)?.[0] ?? '';
          node.textContent = leadWs + translated + trailWs;
        }
      }

      // 2. Element attributes
      for (const item of attrElements) {
        const trimmed = item.original.replace(/\s+/g, ' ').trim();
        const translated = localStorage.getItem(cacheKey(targetLanguage, trimmed));
        if (translated) {
          item.el.setAttribute(item.attr === 'placeholder' ? 'placeholder' : 'title', translated);
        }
      }

      setTimeout(() => {
        isMutatingDOM.current = false;
      }, 60);
    } catch {
      // Keep English source visible on error
    } finally {
      running.current = false;
      setTranslating(false);
    }
  }, [language]);

  useEffect(() => {
    timer.current = window.setTimeout(() => void translatePage(), 80);

    const observer = new MutationObserver(() => {
      if (isMutatingDOM.current || running.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void translatePage(), 300);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      observer.disconnect();
    };
  }, [translatePage, language]);

  const value = useMemo(
    () => ({ language, languageInfo: languageByCode(language), setLanguage, translating }),
    [language, setLanguage, translating],
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) throw new Error('useTranslation must be used within TranslationProvider');
  return context;
}

export function cacheKey(language: string, text: string) {
  return `${cachePrefix}:${language}:${hash(text)}`;
}

export function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (Math.imul(31, result) + value.charCodeAt(index)) | 0;
  }
  return String(result >>> 0);
}
