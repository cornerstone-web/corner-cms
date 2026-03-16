"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFAQPage } from "@/lib/actions/setup-steps";

const DEFAULT_FAQ_ITEMS = [
  {
    question: "What is the Church of Christ?",
    answer: `We put the name "Church of Christ" on the sign here because our goal is to just be followers of Christ, and apart of the Church He established! We see in Scripture that the term "Church of Christ" was used to identify Christians (Romans 16:16).`,
  },
  {
    question: "What Are Your Worship Services Like?",
    answer: `Our goal is to worship in the simple and meaningful ways that Jesus and the apostles taught the New Testament church to worship.\n\nWe sing acapella as a congregation, usually with a mix of older and newer songs (Eph. 5:19). We have several public prayers led on behalf of the congregation, praising God and asking His blessing on our lives, our church, our community, and our world (Matt. 7:7-11).\n\nWe pass around the bread and juice of the Lord's Supper, to remember the death of Jesus as a church family each Sunday (1 Cor. 11:23-26). There is a short devotional thought before the Lord's Supper, intended to prepare our minds to reflect on the sacrifice of Jesus for our sins.\n\nWe pass around trays for our members to give together to support our ministries both locally and globally (1 Cor. 16:1-2). We have a lesson from the Bible, which is intended to be understandable and relevant in encouraging us all to live more faithfully (1 Tim. 4:13).`,
  },
  {
    question: "What is Expected of Me?",
    answer: "Nothing is expected of you at all - you're welcome to simply attend our assemblies. If you are comfortable, you are welcome to sing with us, pray with us, and learn as we open up God's Word! We hope to greet you with smiling faces and help you with whatever you may need. If you have any questions, feel free to ask us - we'd love to talk with you!",
  },
  {
    question: "Do You Have Bible Class For My Children?",
    answer: "At our 9 am Sunday Bible classes, we have classes for all ages, from the newborn nursery to adult studies. The adult class choices include a variety of groupings and topics that change every 3 months. In addition to studying the Bible, our adult classes also usually include a time of taking prayer requests and having a prayer together. We believe you will find these Bible classes to be encouraging and thought-provoking, and our classes are also great places to get to know each other better in a smaller-group setting.",
  },
  {
    question: "How Do I Get More Involved?",
    answer: "We encourage you to take part in all of our different ministries and activities! If you have not placed membership with us to be recognized as a part of our family here, we ask that you reach out to one of our elders - they'll be glad to schedule a time to meet with you! Upon placing membership, you'll receive a GO! Sheet where you can select which ministries you'd like to serve alongside us in. That will help get you plugged into all the different works of the congregation!",
  },
];

interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialItems?: { question: string; answer: string }[];
}

export default function FAQStep({ church, onComplete, initialItems }: StepProps) {
  const [items, setItems] = useState<FaqItem[]>(() =>
    (initialItems ?? DEFAULT_FAQ_ITEMS).map((item, i) => ({ id: i, ...item }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems((prev) => [...prev, { id: Date.now(), question: "", answer: "" }]);
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: number, field: "question" | "answer", value: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  async function handleSubmit() {
    const filled = items.filter((item) => item.question.trim() && item.answer.trim());
    if (filled.length === 0) {
      setError("Please add at least one FAQ item.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveFAQPage(
        church.id,
        church.slug,
        filled.map(({ question, answer }) => ({ question: question.trim(), answer: answer.trim() })),
      );
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">FAQ Page</h2>
        <p className="text-muted-foreground text-sm">
          Answer common questions visitors might have about your church.
        </p>
      </div>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={item.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Question {idx + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                  aria-label="Remove question"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Input
                value={item.question}
                onChange={(e) => updateItem(item.id, "question", e.target.value)}
                placeholder="e.g. What denomination are you?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Answer</Label>
              <Textarea
                value={item.answer}
                onChange={(e) => updateItem(item.id, "answer", e.target.value)}
                placeholder="Your answer..."
                rows={3}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          + Add another question
        </button>
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
