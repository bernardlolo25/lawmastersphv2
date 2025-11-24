'use client';

import * as React from 'react';
import { Flag, Text, SlidersHorizontal, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import type { ChoiceTextSize } from '@/app/gaming-mode/page';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface GamingToolsProps {
  onTextSizeChange: (size: ChoiceTextSize) => void;
  currentTextSize: ChoiceTextSize;
  onReportSubmit: () => Promise<void>;
  isReporting: boolean;
  reportComment: string;
  onReportCommentChange: (comment: string) => void;
}

export function GamingTools({ 
    onTextSizeChange, 
    currentTextSize, 
    onReportSubmit,
    isReporting,
    reportComment,
    onReportCommentChange
}: GamingToolsProps) {

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full h-14 w-14 shadow-lg">
          <SlidersHorizontal className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Game Tools</h4>
            <p className="text-sm text-muted-foreground">
              Adjust your game settings.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
              <p className="text-sm font-medium">Choice Text Size</p>
              <ToggleGroup 
                type="single" 
                value={currentTextSize} 
                onValueChange={(value: ChoiceTextSize) => value && onTextSizeChange(value)}
                className="grid grid-cols-3"
              >
                  <ToggleGroupItem value="sm" aria-label="Small text"><Text size={14}/></ToggleGroupItem>
                  <ToggleGroupItem value="base" aria-label="Medium text"><Text size={18}/></ToggleGroupItem>
                  <ToggleGroupItem value="lg" aria-label="Large text"><Text size={22}/></ToggleGroupItem>
              </ToggleGroup>
          </div>
           <Separator />
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                        <Flag className="mr-2 h-4 w-4"/>
                        Report Question
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle /> Report Question</AlertDialogTitle>
                        <AlertDialogDescription>
                            Let us know what's wrong with this question. Your feedback helps improve the app for everyone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 grid gap-2">
                        <Label htmlFor="report-comment-popover">Describe the issue:</Label>
                        <Textarea 
                            id="report-comment-popover"
                            placeholder="e.g., Typo in the question, Option C is incorrect, the explanation is confusing..."
                            value={reportComment}
                            onChange={(e) => onReportCommentChange(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel id="report-dialog-cancel-popover">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onReportSubmit} disabled={isReporting || !reportComment.trim()}>
                            {isReporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Report
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      </PopoverContent>
    </Popover>
  );
}
