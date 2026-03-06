/*
* USERS PAGE: http://localhost:3000/test
*/
'use client';

import * as React from "react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export default function Page() {
  const [date, setDate] = React.useState<Date>()

  return (
    <div className='flex min-h-screen w-full flex-col'>
      <main className='flex-1'>
        <div className='container mx-auto px-4 py-8 md:py-12 lg:py-16'>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className={cn(
                  'w-[280px] justify-start text-left font-normal',
                  !date && 'text-muted-foreground',
                )}
              >
                {date ? format(date, 'MM/dd/yyyy') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0'>
              <Calendar mode='single' selected={date} onSelect={setDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </main>
    </div>
  );
}
