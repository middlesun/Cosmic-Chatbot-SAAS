import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Currency } from '../../types';

interface SelectedProduct {
  id: string;
  name: string;
  priceINR: number;
  question: string;
}

const QUICK_PRODUCTS = [
  // ## Consultations - Answer to your questions (No reports)
  {
    name: 'Quick Clarity (1 Question)',
    price: 999,
    prices: { INR: 999, USD: 19, EUR: 18 },
    description: 'One question, Delivered in 7–10 Days',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    category: 'Consultations'
  },
  {
    name: 'Deep Analysis (1 Topic)',
    price: 1999,
    prices: { INR: 1999, USD: 35, EUR: 32 },
    description: 'One area of life, 5 questions, Delivered in 7–10 Days',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    category: 'Consultations'
  },
  {
    name: 'Deep Analysis (2 Topics)',
    price: 3999,
    prices: { INR: 3999, USD: 69, EUR: 64 },
    description: 'Two areas of life, 10 questions, Delivered in 7-10 Days',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    category: 'Consultations'
  },
  {
    name: 'Deep Analysis (3 Topics)',
    price: 5999,
    prices: { INR: 5999, USD: 105, EUR: 95 },
    description: 'Three areas of life, 15 questions, Delivered in 7-10 Days',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    category: 'Consultations'
  },

  // ## Reports (Best value for money) - Detailed Reports + Answer to your questions
  {
    name: 'CAREER, FINANCE & FORTUNES (Report)',
    price: 3999,
    prices: { INR: 3999, USD: 69, EUR: 64 },
    description: 'A comprehensive report, Delivered in 10 Days',
    icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
    category: 'Reports (Best value for money)'
  },
  {
    name: 'LOVE & RELATIONSHIPS (Report)',
    price: 3999,
    prices: { INR: 3999, USD: 69, EUR: 64 },
    description: 'A comprehensive report, Delivered in 10 Days',
    icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
    category: 'Reports (Best value for money)'
  },
  {
    name: 'MARRIAGE & MARRIED LIFE (Report)',
    price: 3999,
    prices: { INR: 3999, USD: 69, EUR: 64 },
    description: 'A comprehensive report, Delivered in 10 Days',
    icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
    category: 'Reports (Best value for money)'
  },
  {
    name: 'HEALTH, RECOVERY & MENTAL WELLNESS (Report)',
    price: 3999,
    prices: { INR: 3999, USD: 69, EUR: 64 },
    description: 'A comprehensive report, Delivered in 10 Days',
    icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
    category: 'Reports (Best value for money)'
  },

  // ## Reports Combo (Best Savings on Reports) - Save 15-20% on Reports
  {
    name: 'CAREER + MARRIAGE Reports Combo',
    price: 6999,
    prices: { INR: 6999, USD: 119, EUR: 109 },
    description: 'Two Report Combo, 15% Discount, Delivered in 10 Days',
    icon: 'M19 5L5 19 M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    category: 'Reports Combo (Best Savings on Reports)'
  },
  {
    name: 'CAREER + LOVE Reports Combo',
    price: 6999,
    prices: { INR: 6999, USD: 119, EUR: 109 },
    description: 'Two Report Combo, 15% Discount, Delivered in 10 Days',
    icon: 'M19 5L5 19 M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    category: 'Reports Combo (Best Savings on Reports)'
  },
  {
    name: 'LOVE + HEALTH Reports Combo',
    price: 6999,
    prices: { INR: 6999, USD: 119, EUR: 109 },
    description: 'Two Report Combo, 15% Discount, Delivered in 10 Days',
    icon: 'M19 5L5 19 M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    category: 'Reports Combo (Best Savings on Reports)'
  },
  {
    name: 'CAREER + HEALTH Reports Combo',
    price: 6999,
    prices: { INR: 6999, USD: 119, EUR: 109 },
    description: 'Two Report Combo, 15% Discount, Delivered in 10 Days',
    icon: 'M19 5L5 19 M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    category: 'Reports Combo (Best Savings on Reports)'
  },
  {
    name: 'MARRIAGE + HEALTH Reports Combo',
    price: 6999,
    prices: { INR: 6999, USD: 119, EUR: 109 },
    description: 'Two Report Combo, 15% Discount, Delivered in 10 Days',
    icon: 'M19 5L5 19 M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    category: 'Reports Combo (Best Savings on Reports)'
  },
  {
    name: 'CAREER + LOVE + HEALTH Reports Combo',
    price: 9999,
    prices: { INR: 9999, USD: 169, EUR: 155 },
    description: 'Three Report Combo, 20% Discount, Delivered in 10 Days',
    icon: 'M19 5L5 19 M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    category: 'Reports Combo (Best Savings on Reports)'
  },
  {
    name: 'CAREER + MARRIAGE + HEALTH Reports Combo',
    price: 9999,
    prices: { INR: 9999, USD: 169, EUR: 155 },
    description: 'Three Report Combo, 20% Discount, Delivered in 10 Days',
    icon: 'M19 5L5 19 M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    category: 'Reports Combo (Best Savings on Reports)'
  },

  // ### Priority Service - Premium rush services
  {
    name: 'Quick Clarity (1 Question) 72 Hrs',
    price: 1999,
    prices: { INR: 1999, USD: 35, EUR: 32 },
    description: 'One specific question, Delivered in 72 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Quick Clarity (1 Question) 48 Hrs',
    price: 2999,
    prices: { INR: 2999, USD: 55, EUR: 50 },
    description: 'One specific question, Delivered in 48 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Quick Clarity (1 Question) 24 Hrs',
    price: 3999,
    prices: { INR: 3999, USD: 69, EUR: 64 },
    description: 'One specific question, Delivered in 24 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Deep Analysis (1 Topic) 72 Hrs',
    price: 3999,
    prices: { INR: 3999, USD: 69, EUR: 64 },
    description: 'One area of life, 5 questions, Delivered in 72 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Deep Analysis (1 Topic) 48 Hrs',
    price: 5999,
    prices: { INR: 5999, USD: 105, EUR: 95 },
    description: 'One area of life, 5 questions, Delivered in 48 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Deep Analysis (1 Topic) 24 Hrs',
    price: 7999,
    prices: { INR: 7999, USD: 139, EUR: 129 },
    description: 'One area of life, 5 questions, Delivered in 24 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Deep Analysis (2 Topics) 72 Hrs',
    price: 7999,
    prices: { INR: 7999, USD: 139, EUR: 129 },
    description: 'Two areas of life, 10 questions, Delivered in 72 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Deep Analysis (2 Topics) 48 Hrs',
    price: 10999,
    prices: { INR: 10999, USD: 189, EUR: 175 },
    description: 'Two areas of life, 10 questions, Delivered in 48 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Deep Analysis (2 Topics) 24 Hrs',
    price: 13999,
    prices: { INR: 13999, USD: 239, EUR: 219 },
    description: 'Two areas of life, 10 questions, Delivered in 24 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Deep Analysis (3 Topics) 72 Hrs',
    price: 10999,
    prices: { INR: 10999, USD: 189, EUR: 175 },
    description: 'Three areas of life, 15 questions, Delivered in 72 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Deep Analysis (3 Topics) 48 Hrs',
    price: 15999,
    prices: { INR: 15999, USD: 275, EUR: 255 },
    description: 'Three areas of life, 15 questions, Delivered in 48 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  },
  {
    name: 'Deep Analysis (3 Topics) 24 Hrs',
    price: 20999,
    prices: { INR: 20999, USD: 359, EUR: 329 },
    description: 'Three areas of life, 15 questions, Delivered in 24 Hrs',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    category: 'Priority Service'
  }
];

const CATEGORY_INFOS: Record<string, { title: string, description: string }> = {
  'Consultations': {
    title: 'Consultations',
    description: 'Answer to your questions (No reports)'
  },
  'Reports (Best value for money)': {
    title: 'Reports (Best value for money)',
    description: 'Detailed Reports + Answer to your questions'
  },
  'Reports Combo (Best Savings on Reports)': {
    title: 'Reports Combo (Best Savings on Reports)',
    description: 'Save 15-20% on Reports'
  },
  'Priority Service': {
    title: 'Priority Service',
    description: 'Premium rush services'
  }
};

const getTurnaroundPrice = (itemName: string, turnaround: 'standard' | '72h' | '48h' | '24h') => {
  const baseProduct = QUICK_PRODUCTS.find(p => p.name === itemName) || QUICK_PRODUCTS[0];
  if (turnaround === 'standard') {
    return {
      INR: baseProduct.prices?.INR || baseProduct.price,
      USD: baseProduct.prices?.USD || 0,
      EUR: baseProduct.prices?.EUR || 0
    };
  }

  const suffix = turnaround === '72h' ? '72 Hrs' : turnaround === '48h' ? '48 Hrs' : '24 Hrs';
  // Strip any existing priority suffix from the name
  const cleanName = baseProduct.name.replace(/\s*(72|48|24)\s*Hrs$/i, '').trim();
  const matchName = `${cleanName} ${suffix}`;
  const match = QUICK_PRODUCTS.find(p => p.name.toLowerCase() === matchName.toLowerCase());
  
  if (match) {
    return {
      INR: match.prices?.INR || match.price,
      USD: match.prices?.USD || 0,
      EUR: match.prices?.EUR || 0
    };
  }

  // Fallback pricing calculation
  const baseINR = baseProduct.prices?.INR || baseProduct.price;
  const baseUSD = baseProduct.prices?.USD || 0;
  const baseEUR = baseProduct.prices?.EUR || 0;

  // INR: round to nearest 1000
  const roundINR = Math.round(baseINR / 1000) * 1000;
  // USD and EUR: round to nearest 10
  const roundUSD = Math.round(baseUSD / 10) * 10;
  const roundEUR = Math.round(baseEUR / 10) * 10;

  const multiplier = turnaround === '72h' ? 1 : turnaround === '48h' ? 2 : 3;

  return {
    INR: baseINR + roundINR * multiplier,
    USD: baseUSD + (roundUSD || 10) * multiplier,
    EUR: baseEUR + (roundEUR || 10) * multiplier
  };
};

const getRichCopy = (packageName: string) => {
  const normName = packageName.toLowerCase();
  
  if (normName.includes('quick clarity') || normName.includes('quick question')) {
    return (
      <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
        <p>
          Whether you've been jobless for months and unable to find the right opportunity, under growing pressure to get married but it keeps getting delayed, unsure whether to stay or leave the relationship you're in, dealing with a health condition for too long, have been struggling financially even with the best efforts, or at a crossroads having to make a critical life decision.
        </p>
        <p>
          Whether you're thinking of starting a new business, launching a startup, changing careers, moving to a new city, making a major investment, or chasing some goals that you want to know whether you're made for it or not.
        </p>
        <p>
          <strong className="text-indigo-950 font-bold">Quick Clarity</strong> is designed to help you understand what's happening, why it's happening, and what your chart suggests is most likely to happen next. I'll give you an honest, grounded assessment of your situation so you can make better-informed decisions going forward.
        </p>
        <p className="font-semibold text-indigo-900 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
          Provide as much context as possible, I don't mind reading lengthy back story of the situation and your life - if it helps me understand your situation better.
        </p>
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 text-xs md:text-sm leading-relaxed">
          <strong className="text-rose-600 font-bold">Important:</strong> Ensure you ask only one specific question, if you have more than one question, please select 'Deep Analysis' package.
        </div>
      </div>
    );
  }

  if (normName.includes('deep analysis (1 topic)')) {
    return (
      <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
        <p>
          Get one area of your life deeply analysed using advanced Vedic astrology principles and techniques. I use a multi-system cross-verified approach, combining Parashari, Jaimini, KP, and Siddha Nadi techniques.
        </p>
        <p>
          Choose one area of your life - Career, Finances, Relationships, Marriage, Progeny, Health, Divorces, Second marriage, Progeny, Legal Disputes or something else.
        </p>
        <p className="font-semibold text-indigo-950">
          You can ask 3-5 questions around the same topic. (Max 5)
        </p>
        <p>
          My response will be based on deeper analysis of your entire chart including relevant divisional charts, Nakshatras, ashtakvagras, shadbala, bhav bala, KP chart. Timing windows are predicted using advanced techniques combining Dashas, Transits & KP techniques.
        </p>
        <p>
          A Deep Analysis can provide you a much richer understanding of various dynamics influencing a particular area of your life and things that you can do to potentially overcome it. Understand what's driving your situation, how long it's likely to continue, and what your chart suggests is most likely to happen next.
        </p>
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 text-xs md:text-sm leading-relaxed">
          <strong className="text-rose-600 font-bold">Important:</strong> The depth and length of my response will depend on the nature of your question and the context you provide. Some questions can be answered in just a few lines to a few paragraphs, while others may require a more detailed explanation. I reserve the right to decide the depth of astrological reasoning I share. Sometimes I'll take you through the analysis behind my conclusions in detail; other times, I'll simply provide my predictions and recommendations without explaining how I arrived at that conclusion.
        </div>
        
        <div className="border-t border-indigo-100 pt-4 mt-4 space-y-3">
          <h4 className="font-serif text-base font-bold text-indigo-950">FAQs:</h4>
          <div>
            <h5 className="font-bold text-indigo-900 text-xs md:text-sm">Can I ask follow-up questions?</h5>
            <p className="text-xs text-slate-500">In most cases, yes—especially if you need clarification or a better understanding of my response.</p>
          </div>
          <div>
            <h5 className="font-bold text-indigo-900 text-xs md:text-sm">Do you provide remedies?</h5>
            <p className="text-xs text-slate-500">Yes, where I feel they're necessary or if you've specifically requested them. For more serious cases, I provide detailed remedies separately.</p>
          </div>
        </div>
      </div>
    );
  }

  if (normName.includes('deep analysis (2 topics)')) {
    return (
      <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
        <p>
          Get two distinct areas of your life deeply analysed using advanced Vedic astrology principles and techniques. I use a multi-system cross-verified approach, combining Parashari, Jaimini, KP, and Nadi systems.
        </p>
        <p>
          Choose any two areas of your life - Career, Finances, Relationships, Marriage, Progeny, Health, Divorces, Second marriage, Legal Disputes, or other.
        </p>
        <p className="font-semibold text-indigo-950">
          In addition, you can ask 3-5 questions around each topic.
        </p>
        <p>
          My response will be based on a comprehensive analysis of your birth chart and all relevant divisional charts. Timing windows are predicted using advanced combinations of Dashas, Transits & KP techniques.
        </p>
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 text-xs md:text-sm leading-relaxed">
          <strong className="text-rose-600 font-bold">Important:</strong> The depth and length of my response will depend on the nature of your question and the context you provide. Some questions can be answered in just a few lines to a few paragraphs, while others may require a more detailed explanation. I reserve the right to decide the depth of astrological reasoning I share. Sometimes I'll take you through the analysis behind my conclusions in detail; other times, I'll simply provide my predictions and recommendations without explaining how I arrived at that conclusion.
        </div>
      </div>
    );
  }

  if (normName.includes('deep analysis (3 topics)')) {
    return (
      <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
        <p>
          Get three distinct areas of your life deeply analysed using advanced Vedic astrology principles and techniques. I use a multi-system cross-verified approach, combining Parashari, Jaimini, KP, and Nadi systems.
        </p>
        <p>
          Choose any three areas of your life - Career, Finances, Relationships, Marriage, Progeny, Health, Divorces, Second marriage, Legal Disputes, or other.
        </p>
        <p className="font-semibold text-indigo-950">
          In addition, you can ask 3-5 questions around each topic.
        </p>
        <p>
          My response will be based on a comprehensive analysis of your birth chart and all relevant divisional charts. Timing windows are predicted using advanced combinations of Dashas, Transits & KP techniques.
        </p>
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 text-xs md:text-sm leading-relaxed">
          <strong className="text-rose-600 font-bold">Important:</strong> The depth and length of my response will depend on the nature of your question and the context you provide. Some questions can be answered in just a few lines to a few paragraphs, while others may require a more detailed explanation. I reserve the right to decide the depth of astrological reasoning I share. Sometimes I'll take you through the analysis behind my conclusions in detail; other times, I'll simply provide my predictions and recommendations without explaining how I arrived at that conclusion.
        </div>
      </div>
    );
  }

  if (normName.includes('career, finance & fortunes')) {
    return (
      <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
        <p>
          Based on a detailed analysis of your D1,D9,D2,D10 charts get a deep understanding of the structural themes that are influencing your career & finances.
        </p>
        <p>
          Each report is different and unique depending on the career path and phase you're at. 
        </p>
        <p className="font-semibold text-indigo-950">
          Some of the topics covered could be..
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs md:text-sm text-slate-500">
          <li>A detailed breakdown of the most significant placements</li>
          <li>Most powerful Career & Finance Yogas ranked by strength</li>
          <li>A list of your greatest natural strengths</li>
          <li>The structural themes & patterns you can leverage</li>
          <li>Most powerful career & finance planets ranked</li>
          <li>Hidden weaknesses & karmic blockages</li>
          <li>Dominant Career themes, wealth building patterns</li>
          <li>Most potent obstructing Doshas and how to overcome them</li>
          <li>A list of your biggest weaknesses and blind spots</li>
          <li>Complete technical breakdown of the chart</li>
          <li>Key dates & time periods</li>
          <li>The most salient points to remember</li>
          <li>A list of Strategic and practical advice</li>
          <li>Dasha and transit analysis</li>
          <li>Complete list of all astrological findings of your chart.</li>
        </ul>
        <p className="font-bold text-indigo-950">
          In addition to the report, you can also ask upto 3 Questions.
        </p>
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 text-xs md:text-sm leading-relaxed">
          <strong className="text-rose-600 font-bold">Important:</strong> Please tell me about your educational qualifications, current role, industry, years of experience, the country you're currently based in, and your career goals or future plans. Every bit of context helps me better understand your situation.
        </div>
      </div>
    );
  }

  if (normName.includes('love & relationship')) {
    return (
      <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
        <p>
          Gain a deeper understanding of the relationship patterns, emotional dynamics and romantic influences in your chart. Whether you're single, dating, in a relationship, recovering from heartbreak, or simply trying to understand why certain patterns keep repeating, this report is designed to help you better understand your love life.
        </p>
        <p>
          Each report is tailored to your age, relationship status and the phase of life you're currently in.
        </p>
        <p className="font-semibold text-indigo-950">
          Some of the topics covered could be..
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs md:text-sm text-slate-500">
          <li>A deep narrative explanation of the most dominant relationship themes in your chart</li>
          <li>A detailed overview of D1 & D9 and how your love life is being influenced</li>
          <li>Breakdown of the most significant placements individually</li>
          <li>Most powerful Yogas explained & ranked by strength</li>
          <li>Most potent Doshas & karmic patterns affecting your relationships</li>
        </ul>
        <p className="font-semibold text-indigo-950">
          It covers some of the most commonly asked questions:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs md:text-sm text-slate-500">
          <li>Why do similar relationship patterns keep repeating?</li>
          <li>Why am I unable to find the right partner?</li>
          <li>Relationship timing windows and favourable periods</li>
          <li>Chances of entering a meaningful relationship</li>
          <li>Compatibility with your current or potential partner</li>
          <li>Emotional needs, attachment style and relationship tendencies</li>
          <li>Green flags, red flags and recurring blind spots</li>
          <li>Long-term relationship potential</li>
          <li>Chances of heartbreak, separation or reconciliation</li>
          <li>Most important points to remember</li>
          <li>Strategic and practical advice</li>
          <li>Complete list of all astrological findings related to your relationships</li>
        </ul>
        <p className="font-bold text-indigo-950">
          In addition to the report, you can also ask upto 3 Questions.
        </p>
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 text-xs md:text-sm leading-relaxed">
          <strong className="text-rose-600 font-bold">Important:</strong> Please provide as much context as possible—your past relationships, current relationship, and anything specific you'd like me to know. It helps me provide a more meaningful analysis.
        </div>
      </div>
    );
  }

  if (normName.includes('marriage & married life')) {
    return (
      <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
        <p>
          Get a deeper understanding of your chart related to your Love life, Marriage, Married Life and how and when you can expect things to happen. Depending upon which stage you're the report will cover a variety of topics.
        </p>
        <p>
          Each report is slightly different depending on your age and phase you're at. 
        </p>
        <p className="font-semibold text-indigo-950">
          Some of the topics covered could be..
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs md:text-sm text-slate-500">
          <li>A deep narrative explanation of the most dominant themes in your chart</li>
          <li>A detailed overview of D1 & D9 and how your Love & Marriage is being influenced</li>
          <li>Breakdown of the most significant placements individually</li>
          <li>Most powerful Yogas explained & ranked by strength</li>
          <li>Most potent Doshas & Karmic patterns blocking your happiness</li>
        </ul>
        <p className="font-semibold text-indigo-950">
          It covers some of the most commonly asked questions:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs md:text-sm text-slate-500">
          <li>Specific Marriage timing windows</li>
          <li>Love or arranged marriage?</li>
          <li>Spouse personality traits, profession and more</li>
          <li>Relationship dynamics and compatibility with spouse</li>
          <li>Quality of married life (lived experience)</li>
          <li>Domestic harmony</li>
          <li>Relationship with In-laws</li>
          <li>Chances of divorce, separation, second marriage</li>
          <li>Progeny and legacy</li>
          <li>Career and wealth post marriage</li>
          <li>Most important points to remember</li>
          <li>Strategic and practical advice</li>
          <li>Complete list of all astrological findings of your chart</li>
        </ul>
        <p className="font-bold text-indigo-950">
          In addition to the report, you can also ask upto 3 Questions.
        </p>
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 text-xs md:text-sm leading-relaxed">
          <strong className="text-rose-600 font-bold">Important:</strong> Please provide some background about your love life and marriage. If you're unmarried, tell me about your past relationships, current dating life, and what efforts you've been making towards marriage. If you're married, please include your date of marriage, your age and your spouse's age, a brief overview of your married life so far, and anything specific you'd like me to know.
        </div>
      </div>
    );
  }

  if (normName.includes('health, recovery & mental wellness')) {
    return (
      <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
        <p>
          Based on a detailed analysis of your D1, D9 and other relevant divisional charts, gain a deeper understanding of the structural themes influencing your physical health, mental well-being and overall vitality.
        </p>
        <p>
          Depending on your current circumstances, the report may cover inherited health vulnerabilities, periods of increased resilience or sensitivity, and favourable timing windows for recovery, prevention and long-term well-being.
        </p>
        <p className="font-semibold text-indigo-950">
          Some of the topics covered could be..
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs md:text-sm text-slate-500">
          <li>A detailed breakdown of the most significant placements</li>
          <li>Most powerful Health & Wellness Yogas ranked by strength</li>
          <li>A list of your greatest health strengths and protective factors</li>
          <li>Structural health patterns inherited in the chart</li>
          <li>Physical constitution and natural vulnerabilities</li>
          <li>Mental and emotional well-being patterns</li>
          <li>Stress, anxiety and emotional resilience indicators</li>
          <li>Potential chronic health tendencies and recurring issues</li>
          <li>Periods of increased health sensitivity and recovery</li>
          <li>Dasha and transit analysis for major health periods</li>
          <li>Preventive guidance and favourable timing windows</li>
          <li>Most potent Doshas and karmic health patterns</li>
          <li>Strategic and practical lifestyle recommendations</li>
          <li>The most salient points to remember</li>
          <li>Complete technical breakdown of the chart</li>
          <li>Complete list of all astrological findings related to your health</li>
        </ul>
        <p className="font-bold text-indigo-950">
          In addition to the report, you can also ask upto 3 Questions.
        </p>
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 text-xs md:text-sm leading-relaxed">
          <strong className="text-rose-600 font-bold">Important:</strong> Feel free to tell me about your health journey so far. Whether you're dealing with a long-term condition, recent diagnosis, recurring symptoms, undergoing treatment, taking medication, or simply have concerns about your health, every bit of context helps me better understand your situation.
        </div>
        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
          Please note: If you're going through serious health complications or are seeking insight into a complex medical condition, it may reqquire analysing additional divisional charts (such as D3, D6, D8, D27 and D30) to provide a more comprehensive assessment. This advanced analysis is available for an additional Rs.3000.
        </p>
        <p className="text-xs text-slate-400 italic">
          Disclaimer: I provide astrological analysis and guidance only - not medical advice. While I may suggest potential paths toward recovery, I donot claim to provide specific outcomes or cures.
        </p>
      </div>
    );
  }

  if (normName.includes('combo')) {
    const isThree = normName.includes('three') || (normName.includes('+') ? normName.split('+').length >= 3 : normName.split(',').length >= 3);
    const countText = isThree ? 'three' : 'two';
    
    let areasText = 'Career & Marriage';
    if (normName.includes('career') && normName.includes('marriage')) {
      areasText = 'Career & Marriage';
    } else if (normName.includes('career') && normName.includes('marraige')) {
      areasText = 'Career & Marriage';
    } else if (normName.includes('career') && normName.includes('love')) {
      areasText = 'Career & Love';
    } else if (normName.includes('love') && normName.includes('health')) {
      areasText = 'Love & Health';
    } else if (normName.includes('career') && normName.includes('health')) {
      areasText = 'Career & Health';
    } else if (normName.includes('marriage') && normName.includes('health')) {
      areasText = 'Marriage & Health';
    } else if (normName.includes('marraige') && normName.includes('health')) {
      areasText = 'Marriage & Health';
    }
    
    if (isThree) {
      if (normName.includes('love')) {
        areasText = 'Career, Love & Health';
      } else {
        areasText = 'Career, Marriage & Health';
      }
    }

    return (
      <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
        <p className="font-semibold text-emerald-800 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
          The best value for money combo deal. You'll get {countText} individual reports for your {areasText} based on deep analysis on your entire chart. It is generally a 8-19 page report covering various aspects of your chart's influences in these areas of your life.
        </p>
        <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100/50 space-y-2">
          <h5 className="font-bold text-indigo-950 text-xs uppercase tracking-wider">Combo Value</h5>
          <p className="text-sm text-indigo-900 font-medium">
            This combo deal includes the full, exhaustive reports for each area listed in the title.
          </p>
        </div>
        <div>
          <h5 className="font-bold text-indigo-950 text-xs uppercase tracking-wider mb-2">What's included:</h5>
          <ul className="list-disc pl-5 space-y-1 text-slate-500">
            <li>In-depth analysis for each featured report category in full detail.</li>
            <li>All charts, planetary alignments, active dashas, Nakshatras & transits.</li>
            <li>Multiple strategic advice sections, practical timeline windows & customized remedies.</li>
            <li>Additional questions limit: you can ask questions for each report topic included.</li>
          </ul>
        </div>
        <p className="text-xs text-slate-400 italic">
          * Provide detailed educational, career, health or relationship backstory to enable the deepest analysis.
        </p>
      </div>
    );
  }

  // Find standard description
  const prod = QUICK_PRODUCTS.find(p => p.name.toLowerCase() === normName) || QUICK_PRODUCTS.find(p => p.name === packageName);
  const desc = prod?.description || 'Get professional guidance and astrological insights tailored to your life situation.';

  return (
    <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed animate-fade-in">
      <p>
        Explore a comprehensive analysis designed to bring strategic clarity and peace of mind to this aspect of your life. By looking at planetary placements, strengths, and active timeline influences, we decode the underlying karmic themes of your current experience.
      </p>
      
      <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100/50 space-y-2">
        <h5 className="font-bold text-indigo-950 text-xs uppercase tracking-wider">Package Focus</h5>
        <p className="text-sm text-indigo-900 font-medium">
          {desc}
        </p>
      </div>

      <div>
        <h5 className="font-bold text-indigo-950 text-xs uppercase tracking-wider mb-2">What we will analyze:</h5>
        <ul className="list-disc pl-5 space-y-1 text-xs md:text-sm text-slate-500">
          <li>Core planetary alignments in your birth chart (D1) & supporting divisional charts.</li>
          <li>Current and upcoming active planetary periods (Vimshottari Dasha systems).</li>
          <li>Real-time planetary transits acting as triggers for major life milestones.</li>
          <li>Strategic timelines, warnings, and astrological remedies to ease obstacles.</li>
        </ul>
      </div>

      <p className="text-xs text-slate-400 italic">
        * Provide as much background context as possible. The more backstory you share, the deeper and more relevant my insights will be.
      </p>
    </div>
  );
};

const AmPmDropdown = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative h-14 w-full" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="h-full w-full bg-white border-2 border-indigo-50 rounded-xl flex items-center justify-between px-3 cursor-pointer hover:border-indigo-200 transition-all duration-300 shadow-sm"
      >
        <span className="text-xs font-bold text-indigo-950">{value}</span>
        <svg className={`w-4 h-4 text-indigo-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5"/></svg>
      </div>
      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-1 bg-white border border-indigo-100 rounded-xl shadow-xl z-[100] animate-fade-in overflow-hidden">
          {['AM', 'PM'].map((opt) => (
            <div 
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              className={`px-3 py-3 text-xs font-bold hover:bg-indigo-50 cursor-pointer transition-colors ${value === opt ? 'bg-indigo-50 text-indigo-600' : 'text-indigo-400'}`}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CustomSelectDropdown = ({ 
  value, 
  placeholder, 
  options, 
  onChange 
}: { 
  value: string; 
  placeholder: string; 
  options: { value: string; label: string }[]; 
  onChange: (v: string) => void; 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div className="relative h-14 w-full animate-fade-in" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="h-full w-full bg-white border-2 border-indigo-50 rounded-xl flex items-center justify-between px-3 cursor-pointer hover:border-indigo-200 transition-all duration-300 shadow-sm"
      >
        <span className={`text-xs font-bold ${value ? 'text-indigo-950' : 'text-slate-400'}`}>{selectedLabel}</span>
        <svg className={`w-4 h-4 text-indigo-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5"/></svg>
      </div>
      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-1 bg-white border border-indigo-100 rounded-xl shadow-xl z-[150] animate-fade-in overflow-hidden">
          <div className="max-h-60 overflow-y-auto divide-y divide-indigo-50/30">
            {options.map((opt) => (
              <div 
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`px-3 py-3 text-xs font-bold hover:bg-indigo-50 cursor-pointer transition-colors ${value === opt.value ? 'bg-indigo-50 text-indigo-600' : 'text-indigo-400'}`}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CustomDropdown = ({ value, onPriceText, onChange }: { value: string, onPriceText: (amt: number, name?: string) => string, onChange: (v: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProduct = QUICK_PRODUCTS.find(p => p.name === value);

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-[11.5px] md:text-[13.5px] uppercase font-bold text-indigo-500 tracking-widest mb-3 block">Select Package</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[5rem] px-4 md:px-6 py-4 bg-slate-50 border-2 border-indigo-50 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-between cursor-pointer hover:border-indigo-200 transition-all duration-300 shadow-sm"
      >
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d={selectedProduct?.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-left truncate">
            <p className="font-bold text-indigo-950 text-sm md:text-lg leading-tight truncate">{value}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 ml-2">
          <span className="font-bold text-indigo-950 text-sm md:text-base whitespace-nowrap">{onPriceText(selectedProduct?.price || 0, value)}</span>
          <svg className={`w-5 h-5 md:w-6 md:h-6 text-indigo-300 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5"/></svg>
        </div>
      </div>
      
      {selectedProduct && (
        <p className="mt-2 text-[10px] md:text-xs text-indigo-400 font-medium italic animate-fade-in pl-1">
          {selectedProduct.description}
        </p>
      )}
      
      {isOpen && (
        <div className="fixed inset-0 md:absolute md:inset-auto md:top-full md:left-0 md:w-full mt-0 md:mt-2 bg-white/95 md:bg-white backdrop-blur-xl md:backdrop-blur-none border-t md:border border-indigo-100 rounded-none md:rounded-[2.5rem] shadow-2xl z-[250] animate-fade-in flex flex-col h-full md:h-auto max-h-screen md:max-h-[400px]">
          <div className="flex items-center justify-between p-6 border-b border-indigo-50 md:hidden">
            <span className="font-bold text-indigo-950">Select Package</span>
            <button onClick={() => setIsOpen(false)} className="p-2 text-indigo-300 hover:text-rose-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg>
            </button>
          </div>
          <div className="overflow-y-auto no-scrollbar flex-1 pb-20 md:pb-0">
            {(() => {
              const renderedElements: React.ReactNode[] = [];
              let lastCategory = '';

              QUICK_PRODUCTS.forEach((p, idx) => {
                const category = p.category || 'Consultations';
                if (category !== lastCategory) {
                  const catInfo = CATEGORY_INFOS[category] || { title: category, description: '' };
                  if (idx > 0) {
                    renderedElements.push(
                      <hr key={`sep-${category}`} className="border-t border-indigo-100/40 my-2 mx-6 md:mx-8" />
                    );
                  }
                  renderedElements.push(
                    <div key={`title-${category}`} className="px-6 md:px-8 pt-4 pb-2 bg-slate-50/40 border-b border-indigo-50/20">
                      <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                        {catInfo.title}
                      </div>
                      {catInfo.description && (
                        <div className="text-[10px] md:text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider leading-relaxed">
                          {catInfo.description}
                        </div>
                      )}
                    </div>
                  );
                  lastCategory = category;
                }

                const nextProduct = QUICK_PRODUCTS[idx + 1];
                const hasBorder = nextProduct && nextProduct.category === category;

                renderedElements.push(
                  <div 
                    key={p.name}
                    onClick={() => { onChange(p.name); setIsOpen(false); }}
                    className={`px-6 md:px-8 py-4 md:py-5 ${hasBorder ? 'border-b border-indigo-50' : ''} hover:bg-indigo-50/50 cursor-pointer transition-colors flex items-center justify-between ${value === p.name ? 'bg-indigo-50/30' : ''}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d={p.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="truncate">
                        <p className={`font-bold text-sm md:text-base truncate ${value === p.name ? 'text-indigo-950' : 'text-slate-600'}`}>{p.name}</p>
                        <p className="text-[10px] md:text-xs text-slate-600 font-medium tracking-tight truncate">{p.description}</p>
                      </div>
                    </div>
                    <span className="font-bold text-indigo-950/80 text-sm md:text-base ml-4 whitespace-nowrap">{onPriceText(p.price, p.name)}</span>
                  </div>
                );
              });

              return renderedElements;
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

const BirthFieldsGroup = ({ details, setDetails, showRelation = false, title }: { details: any, setDetails: (d: any) => void, showRelation?: boolean, title: string }) => {
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in w-full">
      <h4 className="font-serif text-lg md:text-xl font-semibold text-indigo-900 border-b border-indigo-100 pb-2">{title}</h4>
      <div className="space-y-4 md:space-y-6">
        <input type="text" required value={details.name} onChange={e => setDetails({...details, name: e.target.value})} className="w-full h-14 md:h-16 px-4 md:px-6 bg-white border-2 border-indigo-50 rounded-xl md:rounded-2xl shadow-sm focus:border-indigo-300 focus:outline-none" placeholder="Your name" />
        {showRelation && <input type="text" required value={details.relationship} onChange={e => setDetails({...details, relationship: e.target.value})} className="w-full h-14 px-4 md:px-6 bg-indigo-50/50 border-2 border-indigo-100 rounded-xl focus:border-indigo-300 focus:outline-none" placeholder="How are you related?" />}
        <div className="grid grid-cols-3 gap-2 p-1 bg-indigo-50 rounded-xl md:rounded-2xl border-2 border-indigo-50 h-14 md:h-16">
          {['male', 'female', 'non-binary'].map(s => (
            <button key={s} type="button" onClick={() => setDetails({...details, sex: s})} className={`h-full rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold uppercase transition-all ${details.sex === s ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-400'}`}>{s}</button>
          ))}
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <CustomSelectDropdown 
            value={details.day} 
            placeholder="Day" 
            options={days.map(d => ({ value: d, label: d }))} 
            onChange={v => setDetails({...details, day: v})} 
          />
          <CustomSelectDropdown 
            value={details.month} 
            placeholder="Month" 
            options={months.map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m }))} 
            onChange={v => setDetails({...details, month: v})} 
          />
          <CustomSelectDropdown 
            value={details.year} 
            placeholder="Year" 
            options={years.map(y => ({ value: y, label: y }))} 
            onChange={v => setDetails({...details, year: v})} 
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
           <input type="text" maxLength={2} placeholder="HH" value={details.tobH} onChange={e => setDetails({...details, tobH: e.target.value})} className="h-14 bg-white border-2 border-indigo-50 rounded-xl text-center shadow-sm focus:outline-none focus:border-indigo-300 text-sm" />
           <input type="text" maxLength={2} placeholder="MM" value={details.tobM} onChange={e => setDetails({...details, tobM: e.target.value})} className="h-14 bg-white border-2 border-indigo-50 rounded-xl text-center shadow-sm focus:outline-none focus:border-indigo-300 text-sm" />
           <input type="text" maxLength={2} placeholder="SS" value={details.tobS} onChange={e => setDetails({...details, tobS: e.target.value})} className="h-14 bg-white border-2 border-indigo-50 rounded-xl text-center shadow-sm focus:outline-none focus:border-indigo-300 text-sm" />
           <AmPmDropdown value={details.tobAP} onChange={v => setDetails({...details, tobAP: v})} />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <input type="text" required value={details.city} onChange={e => setDetails({...details, city: e.target.value})} className="w-full h-14 px-4 md:px-6 bg-white border-2 border-indigo-50 rounded-xl shadow-sm focus:border-indigo-300 focus:outline-none text-sm" placeholder="Birth City" />
          <input type="text" required value={details.state} onChange={e => setDetails({...details, state: e.target.value})} className="w-full h-14 px-4 md:px-6 bg-white border-2 border-indigo-50 rounded-xl shadow-sm focus:border-indigo-300 focus:outline-none text-sm" placeholder="Birth State / Region" />
          <input type="text" required value={details.country} onChange={e => setDetails({...details, country: e.target.value})} className="w-full h-14 px-4 md:px-6 bg-white border-2 border-indigo-50 rounded-xl shadow-sm focus:border-indigo-300 focus:outline-none text-sm" placeholder="Birth Country" />
        </div>
      </div>
    </div>
  );
};

const FilePreview = ({ file, onClear }: { file: File | null, onClear: () => void }) => {
  if (!file) return null;
  return (
    <div className="mt-2 flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm animate-fade-in">
      {file.type.startsWith('image/') ? (
        <img src={URL.createObjectURL(file)} alt="Preview" className="w-12 h-12 md:w-14 md:h-14 object-cover rounded-lg shadow-sm" />
      ) : (
        <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-200 rounded-lg flex items-center justify-center">
           <svg className="w-6 h-6 md:w-7 md:h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth="2"/></svg>
        </div>
      )}
      <div className="flex-1 min-w-0 font-bold text-[10px] md:text-xs text-indigo-900 truncate">{file.name}</div>
      <button type="button" onClick={onClear} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
    </div>
  );
};

interface QuickOrderProps {
  onBack: () => void;
  currency: Currency;
  setCurrency?: (c: Currency) => void;
  initialPackageName?: string | null;
}

const QuickOrder: React.FC<QuickOrderProps> = memo(({ onBack, currency, setCurrency, initialPackageName }) => {
  const [selectedItems, setSelectedItems] = useState<SelectedProduct[]>([{ id: '0', name: 'Deep Analysis (1 Topic)', priceINR: 1999, question: '' }]);
  const [collapsedPackages, setCollapsedPackages] = useState<Record<string, boolean>>({});
  const togglePackageCollapse = (id: string) => setCollapsedPackages(prev => ({ ...prev, [id]: !prev[id] }));
  const [chartMode, setChartMode] = useState<'my' | 'someone' | 'both'>('my');
  const [birthDetails, setBirthDetails] = useState({ name: '', day: '', month: '', year: '', tobH: '', tobM: '', tobS: '', tobAP: 'AM', city: '', state: '', country: '', sex: 'male' });
  const [secondBirthDetails, setSecondBirthDetails] = useState({ name: '', day: '', month: '', year: '', tobH: '', tobM: '', tobS: '', tobAP: 'AM', city: '', state: '', country: '', sex: 'male', relationship: '' });
  const [personalDetails, setPersonalDetails] = useState({ name: '', email: '', anythingElse: '', botcheck: '' });
  const [myChart, setMyChart] = useState<File | null>(null);
  const [secondChart, setSecondChart] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderState, setOrderState] = useState<'form' | 'inr-payment' | 'success'>('form');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ products: true, birth_details: true, final: true });
  const [deliveryUpgrade, setDeliveryUpgrade] = useState<'standard' | '72h' | '48h' | '24h'>('standard');
  const [priceChanged, setPriceChanged] = useState(false);

  const subTotalINR = selectedItems.reduce((acc, item) => acc + getTurnaroundPrice(item.name, deliveryUpgrade).INR, 0);

  useEffect(() => {
    setPriceChanged(true);
    const t = setTimeout(() => setPriceChanged(false), 220);
    return () => clearTimeout(t);
  }, [subTotalINR]);

  const formatPrice = useCallback((amountINR: number, name?: string) => {
    if (currency === Currency.INR) return `₹${amountINR.toLocaleString('en-IN')}`;
    if (name) {
      const p = getTurnaroundPrice(name, deliveryUpgrade);
      const val = currency === Currency.USD ? p.USD : p.EUR;
      return currency === Currency.USD ? `$${val}` : `€${val}`;
    }
    // If we're formatting subTotalINR or sum of multiple, let's find the selectedItems and sum up their currency prices
    if (amountINR === subTotalINR) {
      const sum = selectedItems.reduce((acc, item) => {
        const prod = getTurnaroundPrice(item.name, deliveryUpgrade);
        return acc + (currency === Currency.USD ? prod.USD : prod.EUR);
      }, 0);
      return currency === Currency.USD ? `$${sum}` : `€${sum}`;
    }
    const prod = QUICK_PRODUCTS.find(p => p.price === amountINR);
    if (prod && prod.prices) {
      const val = currency === Currency.USD ? prod.prices.USD : prod.prices.EUR;
      return currency === Currency.USD ? `$${val}` : `€${val}`;
    }
    const map: Record<number, number> = { 999: 19, 1999: 39, 3999: 78, 4999: 146, 9999: 214 };
    const base = map[amountINR] || Math.ceil((amountINR * 1.3) / (currency === Currency.USD ? 70 : 65));
    return currency === Currency.USD ? `$${base}` : `€${base}`;
  }, [currency, selectedItems, subTotalINR, deliveryUpgrade]);

  const getTurnaroundTime = useCallback(() => {
    if (deliveryUpgrade === '72h') return "72 Hrs";
    if (deliveryUpgrade === '48h') return "48 Hrs";
    if (deliveryUpgrade === '24h') return "24 Hrs";
    if (subTotalINR > 10000) return "10-15 days";
    return "7-10 days";
  }, [deliveryUpgrade, subTotalINR]);

  useEffect(() => {
    const saved = localStorage.getItem('cc_quick_order_v5');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (initialPackageName) {
        const prod = QUICK_PRODUCTS.find(p => p.name === initialPackageName);
        if (prod) {
          setSelectedItems([{ id: '0', name: prod.name, priceINR: prod.price, question: '' }]);
        } else {
          setSelectedItems(parsed.selectedItems || []);
        }
      } else {
        setSelectedItems(parsed.selectedItems || []);
      }
      setBirthDetails(parsed.birthDetails || { name: '', day: '', month: '', year: '', tobH: '', tobM: '', tobS: '', tobAP: 'AM', city: '', state: '', country: '', sex: 'male' });
      setSecondBirthDetails(parsed.secondBirthDetails || { name: '', day: '', month: '', year: '', tobH: '', tobM: '', tobS: '', tobAP: 'AM', city: '', state: '', country: '', sex: 'male', relationship: '' });
      setPersonalDetails({
        name: parsed.personalDetails?.name || '',
        email: parsed.personalDetails?.email || '',
        anythingElse: parsed.personalDetails?.anythingElse || '',
        botcheck: ''
      });
      setChartMode(parsed.chartMode || 'my');
      setDeliveryUpgrade(parsed.deliveryUpgrade || 'standard');
    } else if (initialPackageName) {
      const prod = QUICK_PRODUCTS.find(p => p.name === initialPackageName);
      if (prod) {
        setSelectedItems([{ id: '0', name: prod.name, priceINR: prod.price, question: '' }]);
      }
    }
    setIsLoaded(true);
  }, [initialPackageName]);

  useEffect(() => {
    if (!isLoaded) return;
    setAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      localStorage.setItem('cc_quick_order_v5', JSON.stringify({ selectedItems, birthDetails, secondBirthDetails, personalDetails, chartMode, deliveryUpgrade }));
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, 2000);
    return () => clearTimeout(timer);
  }, [selectedItems, birthDetails, secondBirthDetails, personalDetails, chartMode, deliveryUpgrade, isLoaded]);

  const toggleSection = (id: string) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

  const formatBirthDetails = (details: any) => {
    return `Name: ${details.name || 'Anonymous'}
DOB : ${details.day}/${details.month}/${details.year}
TOB : ${details.tobH}:${details.tobM} (${details.tobAP})
POB : ${details.city}${details.state ? ', ' + details.state : ''}${details.country ? ', ' + details.country : ''}
Sex : ${details.sex}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDetails.day || !birthDetails.month || !birthDetails.year) {
      alert("Please select Day, Month, and Year for Date of Birth.");
      return;
    }
    if (chartMode !== 'my' && (!secondBirthDetails.day || !secondBirthDetails.month || !secondBirthDetails.year)) {
      alert("Please select Day, Month, and Year for the second person's Date of Birth.");
      return;
    }
    for (const item of selectedItems) {
      const trimmed = item.question.trim();
      if (trimmed.length > 0) {
        if (trimmed.split(/\s+/).filter(w => w.length > 0).length < 10) {
          alert(`Question for ${item.name} must be at least 10 words.`);
          return;
        }
      }
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY,
          subject: `QUICK ORDER: ${personalDetails.name} - ${formatPrice(subTotalINR)}`,
          Price: formatPrice(subTotalINR),
          "Your Email": personalDetails.email,
          Name: personalDetails.name,
          "Birth details": formatBirthDetails(birthDetails),
          "Second Birth details": chartMode !== 'my' ? formatBirthDetails(secondBirthDetails) : "None",
          Package: JSON.stringify(selectedItems.map(item => ({ Package: item.name, Questions: item.question }))),
          botcheck: personalDetails.botcheck,
          My_Chart: myChart ? myChart.name : "None",
          Second_Chart: secondChart ? secondChart.name : "None",
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (currency === Currency.INR) {
          setOrderState('inr-payment');
        } else {
          localStorage.removeItem('cc_quick_order_v5');
          setPersonalDetails({ name: '', email: '', anythingElse: '', botcheck: '' });
          setSelectedItems([{ id: '0', name: 'Deep Analysis (1 Topic)', priceINR: 1999, question: '' }]);
          setBirthDetails({ name: '', day: '', month: '', year: '', tobH: '', tobM: '', tobS: '', tobAP: 'AM', city: '', state: '', country: '', sex: 'male' });
          setSecondBirthDetails({ name: '', day: '', month: '', year: '', tobH: '', tobM: '', tobS: '', tobAP: 'AM', city: '', state: '', country: '', sex: 'male', relationship: '' });
          setMyChart(null);
          setSecondChart(null);

          const amt = formatPrice(subTotalINR).replace(/[^0-9.]/g, '');
          window.location.href = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=chrisbasu7@gmail.com&item_name=Astrology%20Bundle&amount=${amt}&currency_code=${currency}`;
        }
      } else {
        setError(data.message || "Failed to process order details. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderState === 'inr-payment') {
    return (
      <div className="max-w-xl mx-auto px-4 md:px-6 py-20 text-center animate-slide-up-fade">
        <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 border border-indigo-50 shadow-2xl space-y-6 md:space-y-10">
          <h2 className="font-serif text-2xl md:text-3xl text-indigo-950 font-bold">Complete Your Order</h2>
          <div className="space-y-1">
            <p className="font-bold text-indigo-950 uppercase tracking-tight text-lg">
              {selectedItems.length > 1 ? "Selected Packages Bundle" : selectedItems[0]?.name}
            </p>
            <p className="text-indigo-600 font-bold text-xl">{formatPrice(subTotalINR)}</p>
          </div>
          <div className="mx-auto w-56 h-56 md:w-64 md:h-64 border-4 border-indigo-950 rounded-3xl overflow-hidden p-2 shadow-2xl">
            <img src="https://www.cosmiccouncil.pro/qr.jpeg" className="w-full h-full object-contain" alt="QR" />
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">UPI ID</p>
            <p className="text-2xl font-bold text-indigo-950">chrisbasu7@ybl</p>
            <p className="text-xs text-slate-600 mt-4 leading-relaxed">Once payment is made, send the payment screenshot from your email to <br/><span className="font-bold text-indigo-950">cosmiccouncil.services@gmail.com</span> as confirmation.</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => window.location.reload()} className="w-full py-4 md:py-5 btn-gradient-indigo text-white rounded-2xl md:rounded-3xl font-bold uppercase tracking-widest text-sm md:text-base">Done</button>
            <button onClick={() => setOrderState('form')} className="w-full py-4 md:py-5 border-2 border-indigo-50 text-indigo-400 rounded-2xl md:rounded-3xl font-bold uppercase tracking-widest text-sm md:text-base">Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-20 animate-fade-in relative">
      <div className={`fixed top-24 right-4 md:right-6 z-[200] px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-white/80 backdrop-blur-md border border-indigo-100 shadow-lg text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-2 transition-all duration-500 ${autoSaveStatus !== 'idle' ? 'opacity-100' : 'opacity-0'}`}>
        {autoSaveStatus === 'saving' ? 'Auto-saving...' : 'Auto-saved'}
      </div>

      <button onClick={onBack} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-950 mb-8 md:mb-12 group">
        <svg className="w-5 h-5 group-hover:-translate-x-1.5 transition-silky" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
        <span className="text-xs md:text-sm font-bold uppercase tracking-[0.2em]">Back</span>
      </button>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-indigo-50 shadow-2xl overflow-hidden">
        <div className="p-6 md:p-10 bg-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <h1 className="font-serif text-2xl md:text-4xl font-semibold text-left">Book your reading</h1>
          <div className="flex flex-col items-start md:items-end gap-3 flex-shrink-0">
            {setCurrency && (
              <div className="flex bg-white/10 p-1 rounded-full border border-white/10">
                {Object.values(Currency).map(c => (
                  <button 
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`px-2.5 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold tracking-wider transition-all ${currency === c ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="flex bg-white/10 p-1 rounded-full border border-white/10">
              {[
                { id: 'standard', label: 'Standard' },
                { id: '72h', label: '72 Hours' },
                { id: '48h', label: '48 Hours' },
                { id: '24h', label: '24 Hours' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDeliveryUpgrade(opt.id as any)}
                  className={`px-2.5 md:px-3 py-1 rounded-full text-[8.5px] md:text-[9.5px] font-bold tracking-wider transition-all ${deliveryUpgrade === opt.id ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="divide-y divide-indigo-50">
          <div className="bg-[#7c6d5e]/5">
            <div onClick={() => toggleSection('products')} className={`p-5 md:p-8 flex items-center justify-between cursor-pointer hover:bg-indigo-50/20 transition-all duration-300 ${openSections.products ? 'bg-white/40' : ''}`}>
              <h3 className="font-serif text-xl md:text-2xl text-indigo-950 font-semibold flex items-center gap-3 md:gap-4">
                <span className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-[#7c6d5e] text-xs md:text-sm flex items-center justify-center font-bold shadow-sm">01</span> Choose your Package
              </h3>
              <svg className={`w-5 h-5 md:w-6 md:h-6 text-indigo-300 transition-transform duration-500 ${openSections.products ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2"/></svg>
            </div>
            <div className={`overflow-hidden transition-all duration-700 ease-in-out ${openSections.products ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
              <div className="p-4 md:p-10 pt-0 space-y-6 md:space-y-12">
                {selectedItems.map((item, idx) => {
                  const isCollapsed = !!collapsedPackages[item.id];
                  return (
                    <div key={item.id} className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border border-indigo-100 shadow-sm space-y-6 md:space-y-8">
                      <div 
                        className={`flex items-center justify-between ${isCollapsed ? '' : 'border-b border-indigo-50 pb-4'} cursor-pointer select-none`}
                        onClick={() => togglePackageCollapse(item.id)}
                      >
                        <h4 className="font-serif text-sm md:text-base font-semibold text-indigo-950 uppercase tracking-tight flex items-center gap-1.5 flex-wrap">
                          <span>Package - {idx + 1}:</span>
                          <span className="text-sm md:text-base font-sans font-bold text-indigo-600 capitalize normal-case flex items-center gap-1">
                            <span>{item.name.substring(0, 25)}{item.name.length > 25 ? '...' : ''}</span>
                            <span className="text-indigo-400/70 font-medium">...</span>
                            <span className="font-['DM_Sans',sans-serif] tabular-nums text-indigo-950 font-extrabold">{formatPrice(getTurnaroundPrice(item.name, deliveryUpgrade).INR, item.name)}</span>
                          </span>
                        </h4>
                        <div className="flex items-center gap-3">
                          {selectedItems.length > 1 && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedItems(selectedItems.filter((_, i) => i !== idx)); }} className="text-rose-300 hover:text-rose-600 transition-colors p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
                          )}
                          <svg className={`w-5 h-5 text-indigo-300 transition-transform duration-500 ${!isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2"/></svg>
                        </div>
                      </div>
                      
                      {!isCollapsed && (
                        <>
                          <CustomDropdown value={item.name} onPriceText={formatPrice} onChange={v => { const prod = QUICK_PRODUCTS.find(p => p.name === v); const n = [...selectedItems]; n[idx].name = v; n[idx].priceINR = prod?.price || 1999; setSelectedItems(n); }} />
                          <div className="flex flex-col space-y-2 animate-fade-in">
                            <div className="relative flex flex-col">
                              {/* Scrollable Container */}
                              <div 
                                className="h-[260px] md:h-[483px] overflow-y-auto bg-[#FAFBFF] border border-[#eef2ff] rounded-2xl text-left shadow-sm custom-scrollbar cursor-default select-text flex flex-col scroll-smooth relative"
                                style={{
                                  WebkitOverflowScrolling: 'touch',
                                  scrollbarGutter: 'stable'
                                }}
                              >
                                <style>{`
                                  .custom-scrollbar {
                                    scrollbar-width: thin;
                                    scrollbar-color: transparent transparent;
                                    scrollbar-gutter: stable;
                                  }
                                  .custom-scrollbar::-webkit-scrollbar {
                                    width: 6px;
                                  }
                                  .custom-scrollbar::-webkit-scrollbar-track {
                                    background: transparent;
                                  }
                                  .custom-scrollbar::-webkit-scrollbar-thumb {
                                    background: transparent;
                                    border-radius: 20px;
                                  }
                                  .custom-scrollbar:hover {
                                    scrollbar-color: #c7d2fe transparent;
                                  }
                                  .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                                    background-color: #e0e7ff;
                                  }
                                  .custom-scrollbar:hover::-webkit-scrollbar-thumb:hover {
                                    background-color: #c7d2fe;
                                  }
                                `}</style>
                                <div className="sticky top-0 bg-[#FAFBFF] px-4 md:px-6 pt-4 md:pt-5 pb-3 border-b border-indigo-50/50 z-10 flex items-center justify-between rounded-t-2xl">
                                  <h4 className="font-serif text-sm md:text-base font-bold text-slate-400 leading-tight">About {item.name}</h4>
                                </div>
                                <div className="px-4 md:px-6 pb-6 md:pb-8 pt-4 flex-1 text-[15px] md:text-base" style={{ lineHeight: '1.68' }}>
                                  {getRichCopy(item.name)}
                                </div>
                              </div>
                              {/* Subtle bottom fade to hint at more content */}
                              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#FAFBFF] to-transparent pointer-events-none rounded-b-2xl z-20" />
                            </div>
                          </div>
                          <div className="relative">
                            <label className="text-[11.5px] md:text-[13.5px] uppercase font-bold text-indigo-500 tracking-widest mb-3 block">
                              Your questions & context
                              <span className="text-[11px] md:text-xs text-indigo-500 mt-1 block leading-relaxed font-medium normal-case tracking-normal">
                                Feel free to provide as much context and detail as you'd like. The more context you provide, the more accurate and relevant my analysis is likely to be.
                              </span>
                            </label>
                            <div className="relative">
                              <textarea value={item.question} onChange={e => { const n = [...selectedItems]; n[idx].question = e.target.value; setSelectedItems(n); }} className="w-full p-4 md:p-6 bg-slate-50 border-2 border-indigo-50 rounded-xl md:rounded-[2rem] text-sm md:text-lg min-h-[220px] md:min-h-[300px] focus:outline-none focus:border-indigo-200 transition-all pr-10 md:pr-12" />
                              <button type="button" onClick={() => { const n = [...selectedItems]; n[idx].question = ''; setSelectedItems(n); }} className="absolute right-4 md:right-6 top-6 text-indigo-200 hover:text-rose-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={() => setSelectedItems([...selectedItems, { id: String(Date.now()), name: 'Deep Analysis (1 Topic)', priceINR: 1999, question: '' }])} className="w-full py-4 md:py-6 border-2 border-dashed border-[#7c6d5e]/30 rounded-xl md:rounded-[2rem] text-[#7c6d5e] font-bold uppercase tracking-widest hover:border-[#7c6d5e] transition-all flex items-center justify-center gap-3 text-xs md:text-sm">
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" strokeWidth="2.5"/></svg> Add another package
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/40">
            <div onClick={() => toggleSection('birth_details')} className={`p-5 md:p-8 flex items-center justify-between cursor-pointer hover:bg-indigo-50/20 transition-all duration-300 ${openSections.birth_details ? 'bg-white' : ''}`}>
              <h3 className="font-serif text-xl md:text-2xl text-indigo-950 font-semibold flex items-center gap-3 md:gap-4">
                <span className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-[#7c6d5e] text-xs md:text-sm flex items-center justify-center font-bold shadow-sm">02</span> Enter Birth Details
              </h3>
              <svg className={`w-5 h-5 md:w-6 md:h-6 text-indigo-300 transition-transform duration-500 ${openSections.birth_details ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2"/></svg>
            </div>
            <div className={`overflow-hidden transition-all duration-700 ease-in-out ${openSections.birth_details ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
              <div className="p-4 md:p-10 pt-0 space-y-8 md:space-y-12">
                <div className="flex bg-indigo-50/50 p-1 rounded-xl md:rounded-2xl border border-indigo-100 w-full mx-auto">
                  <button type="button" onClick={() => setChartMode('my')} className={`flex-1 h-10 md:h-12 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold uppercase transition-all ${chartMode === 'my' ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-400'}`}>My Chart</button>
                  <button type="button" onClick={() => setChartMode('someone')} className={`flex-1 h-10 md:h-12 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold uppercase transition-all ${chartMode === 'someone' ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-400'}`}>Someone's</button>
                  <button type="button" onClick={() => setChartMode('both')} className={`flex-1 h-10 md:h-12 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold uppercase transition-all ${chartMode === 'both' ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-400'}`}>Both</button>
                </div>
                <div className="flex flex-col gap-10 md:gap-12 w-full">
                  {(chartMode === 'my' || chartMode === 'both') && (
                    <BirthFieldsGroup title={chartMode === 'both' ? "First Profile" : "Birth Details"} details={birthDetails} setDetails={setBirthDetails} />
                  )}
                  {(chartMode === 'someone' || chartMode === 'both') && (
                    <div className={chartMode === 'both' ? "pt-10 md:pt-12 border-t border-indigo-100" : ""}>
                      <BirthFieldsGroup title={chartMode === 'both' ? "Second Profile" : "Native's Details"} details={secondBirthDetails} setDetails={setSecondBirthDetails} showRelation={true} />
                    </div>
                  )}
                </div>

                <div className="pt-10 border-t border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest block">My Chart <span className="text-slate-400 italic font-normal">(Optional)</span></label>
                    <input type="file" onChange={e => setMyChart(e.target.files?.[0] || null)} className="w-full text-[10px] text-indigo-200 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-[#7c6d5e] file:font-bold" />
                    <FilePreview file={myChart} onClear={() => setMyChart(null)} />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest block">Second Chart <span className="text-slate-400 italic font-normal">(Optional)</span></label>
                    <input type="file" onChange={e => setSecondChart(e.target.files?.[0] || null)} className="w-full text-[10px] text-indigo-200 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-[#7c6d5e] file:font-bold" />
                    <FilePreview file={secondChart} onClear={() => setSecondChart(null)} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white">
            <div onClick={() => toggleSection('final')} className={`p-5 md:p-8 flex items-center justify-between cursor-pointer hover:bg-indigo-50/20 transition-all duration-300 ${openSections.final ? 'bg-white' : ''}`}>
              <h3 className="font-serif text-xl md:text-2xl text-indigo-950 font-semibold flex items-center gap-3 md:gap-4">
                <span className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white text-[#7c6d5e] text-xs md:text-sm flex items-center justify-center font-bold shadow-sm">03</span> Checkout
              </h3>
              <svg className={`w-5 h-5 md:w-6 md:h-6 text-indigo-300 transition-transform duration-500 ${openSections.final ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2"/></svg>
            </div>
            <div className={`overflow-hidden transition-all duration-700 ease-in-out ${openSections.final ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
              <div className="p-4 md:p-10 pt-0 space-y-8 md:space-y-12">
                <div className="relative">
                  <label className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest mb-3 block">Anything else you would want me to know</label>
                  <textarea value={personalDetails.anythingElse} onChange={e => setPersonalDetails({...personalDetails, anythingElse: e.target.value})} className="w-full p-4 md:p-6 bg-slate-50 border-2 border-indigo-50 rounded-xl md:rounded-[2rem] min-h-[100px] md:min-h-[140px] focus:outline-none pr-10 md:pr-12 text-sm md:text-lg" placeholder="" />
                  <button type="button" onClick={() => setPersonalDetails({...personalDetails, anythingElse: ''})} className="absolute right-4 md:right-6 top-14 md:top-16 text-indigo-200 hover:text-rose-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <input type="text" required value={personalDetails.name} onChange={e => setPersonalDetails({...personalDetails, name: e.target.value})} className="h-14 md:h-16 px-4 md:px-6 bg-slate-50 border-2 border-indigo-50 rounded-xl md:rounded-2xl focus:outline-none shadow-sm text-sm md:text-lg" placeholder="Your Name" />
                  <input type="email" required value={personalDetails.email} onChange={e => setPersonalDetails({...personalDetails, email: e.target.value})} className="h-14 md:h-16 px-4 md:px-6 bg-slate-50 border-2 border-indigo-50 rounded-xl md:rounded-2xl focus:outline-none shadow-sm text-sm md:text-lg" placeholder="Contact Email" />
                </div>

                {/* Selected Package Summary */}
                <div className="space-y-3 pt-4 border-t border-indigo-50/50">
                  <label className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest block">Selected Packages</label>
                  <div className="bg-slate-50/50 rounded-2xl border border-indigo-50/50 p-4 md:p-6 space-y-4">
                    {selectedItems.map((item) => {
                      const prod = QUICK_PRODUCTS.find(p => p.name === item.name);
                      const finalPriceObj = getTurnaroundPrice(item.name, deliveryUpgrade);
                      const finalPriceFormatted = currency === Currency.INR 
                        ? `₹${finalPriceObj.INR.toLocaleString('en-IN')}` 
                        : (currency === Currency.USD ? `$${finalPriceObj.USD}` : `€${finalPriceObj.EUR}`);
                      
                      // Turnaround time display text
                      let deliveryText = 'Standard (7–10 Days)';
                      if (deliveryUpgrade === '72h') deliveryText = '⚡ 72 Hrs';
                      else if (deliveryUpgrade === '48h') deliveryText = '⚡ 48 Hrs';
                      else if (deliveryUpgrade === '24h') deliveryText = '⚡ 24 Hrs';

                      return (
                        <div key={item.id} className="border-b border-indigo-50/30 last:border-0 pb-3 last:pb-0">
                          <div className="flex justify-between items-start text-sm md:text-base text-slate-700 font-semibold gap-2">
                            <span className="truncate max-w-[70%] text-indigo-950">{item.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-indigo-950 font-['DM_Sans',sans-serif] tabular-nums">{finalPriceFormatted}</span>
                              {selectedItems.length > 1 && (
                                <button 
                                  type="button" 
                                  onClick={() => setSelectedItems(selectedItems.filter(i => i.id !== item.id))} 
                                  className="text-rose-400 hover:text-rose-600 transition-colors p-1"
                                  aria-label="Remove Package"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                          {prod?.description && (
                            <p className="text-[11px] text-slate-500 mt-1 font-medium">{prod.description}</p>
                          )}
                          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-1 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            {deliveryText}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Faster Delivery Section */}
                <div className="space-y-4 pt-4 border-t border-indigo-50/50">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-indigo-900 tracking-wide block">Need it sooner?</label>
                    <p className="text-[11px] md:text-xs text-slate-500 font-medium">You can upgrade the delivery time of your reading.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'standard', label: 'Standard', sub: '7–10 Days' },
                      { id: '72h', label: '⚡ 72 Hrs', sub: '+3 Days' },
                      { id: '48h', label: '⚡ 48 Hrs', sub: '+2 Days' },
                      { id: '24h', label: '⚡ 24 Hrs', sub: '+1 Day' }
                    ].map(opt => {
                      const isSelected = deliveryUpgrade === opt.id;
                      let diffText = '';
                      if (opt.id !== 'standard') {
                        const itemPrices = selectedItems.map(item => {
                          const stdP = getTurnaroundPrice(item.name, 'standard');
                          const upP = getTurnaroundPrice(item.name, opt.id as any);
                          return {
                            INR: upP.INR - stdP.INR,
                            USD: upP.USD - stdP.USD,
                            EUR: upP.EUR - stdP.EUR
                          };
                        });
                        const diffINR = itemPrices.reduce((acc, p) => acc + p.INR, 0);
                        const diffUSD = itemPrices.reduce((acc, p) => acc + p.USD, 0);
                        const diffEUR = itemPrices.reduce((acc, p) => acc + p.EUR, 0);
                        
                        if (currency === Currency.INR) diffText = `+₹${diffINR.toLocaleString('en-IN')}`;
                        else if (currency === Currency.USD) diffText = `+$${diffUSD}`;
                        else diffText = `+€${diffEUR}`;
                      } else {
                        diffText = 'Included';
                      }

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDeliveryUpgrade(opt.id as any)}
                          className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all duration-300 text-center select-none ${
                            isSelected 
                              ? 'bg-indigo-950 text-white border-indigo-950 shadow-md' 
                              : 'bg-white text-slate-700 border-indigo-50/80 hover:border-indigo-200'
                          }`}
                        >
                          <span className="text-xs md:text-sm font-bold tracking-wide">{opt.label}</span>
                          <span className={`text-[9px] md:text-[10px] font-semibold mt-1 uppercase tracking-wider ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {opt.id === 'standard' ? opt.sub : diffText}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <input 
                  type="text" 
                  name="botcheck" 
                  value={personalDetails.botcheck} 
                  onChange={e => setPersonalDetails({...personalDetails, botcheck: e.target.value})} 
                  className="hidden" 
                  style={{ display: "none" }} 
                />

                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-bold text-sm text-center">
                    {error}
                  </div>
                )}

                <div className="pt-8 md:pt-10 border-t border-indigo-50 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
                  <div className="text-center md:text-left">
                    <p className="text-[9px] md:text-[10px] uppercase font-bold text-indigo-500 tracking-widest mb-1">Total</p>
                    <p className={`text-4xl md:text-6xl font-bold text-indigo-950 leading-none transition-all duration-200 ${priceChanged ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}>{formatPrice(subTotalINR)}</p>
                    <p className="mt-2 md:mt-3 text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#7c6d5e] flex items-center justify-center md:justify-start gap-2">
                      <svg className="w-3.5 h-3.5 md:w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
                      Delivered in {getTurnaroundTime()}
                    </p>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-10 md:px-16 py-4 md:py-6 btn-gradient-indigo text-white rounded-xl md:rounded-[2rem] font-bold tracking-[0.1em] md:tracking-[0.2em] uppercase shadow-2xl hover:brightness-110 active:scale-95 transition-all duration-300 text-xs md:text-lg">
                    {isSubmitting ? 'Processing...' : (currency === Currency.INR ? 'Proceed to Pay' : 'Checkout via PayPal')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
});

export default QuickOrder;