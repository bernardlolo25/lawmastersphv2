
'use client';

import * as React from 'react';
import { Palette, Highlighter, Type, Sun, Moon, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';

export type FontOption = 'font-body' | 'font-headline';
export type ThemeOption = 'theme-light' | 'theme-sepia' | 'theme-dark';

interface ReadingToolsProps {
    onFontChange: (font: FontOption) => void;
    onThemeChange: (theme: ThemeOption) => void;
    currentFont: FontOption;
    currentTheme: ThemeOption;
}

export function ReadingTools({ onFontChange, onThemeChange, currentFont, currentTheme }: ReadingToolsProps) {

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" className="rounded-full h-14 w-14 shadow-lg">
          <Palette className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Reading Tools</h4>
            <p className="text-sm text-muted-foreground">
              Customize your reading experience.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
              <p className="text-sm font-medium">Font Style</p>
              <ToggleGroup type="single" value={currentFont} onValueChange={(value: FontOption) => value && onFontChange(value)} className="grid grid-cols-2">
                  <ToggleGroupItem value="font-body" aria-label="Sans-serif font" className="h-12 flex-col gap-1">
                      <Type className="h-5 w-5"/>
                      <span className="text-xs">Sans-serif</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="font-headline" aria-label="Serif font" className="h-12 flex-col gap-1">
                       <span className="font-headline text-xl">T</span>
                       <span className="text-xs">Serif</span>
                  </ToggleGroupItem>
              </ToggleGroup>
          </div>
           <div className="space-y-2">
              <p className="text-sm font-medium">Color Theme</p>
              <ToggleGroup type="single" value={currentTheme} onValueChange={(value: ThemeOption) => value && onThemeChange(value)} className="grid grid-cols-3">
                  <ToggleGroupItem value="theme-light" aria-label="Light theme" className="h-12 flex-col gap-1">
                      <Sun className="h-5 w-5"/>
                      <span className="text-xs">Light</span>
                  </ToggleGroupItem>
                   <ToggleGroupItem value="theme-sepia" aria-label="Sepia theme" className="h-12 flex-col gap-1">
                      <Coffee className="h-5 w-5"/>
                      <span className="text-xs">Sepia</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="theme-dark" aria-label="Dark theme" className="h-12 flex-col gap-1">
                      <Moon className="h-5 w-5"/>
                      <span className="text-xs">Dark</span>
                  </ToggleGroupItem>
              </ToggleGroup>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
