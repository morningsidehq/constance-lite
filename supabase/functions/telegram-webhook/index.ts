import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  try {
    const { message } = await req.json()
    
    // Check if this is a reply to a support message
    if (message.reply_to_message) {
      const originalMessageId = message.reply_to_message.text.match(/#msg(\d+)/)?.[1]
      
      if (originalMessageId) {
        // Get the original message to get user_id
        const { data: originalMessage } = await supabase
          .from('support_messages')
          .select('user_id')
          .eq('id', originalMessageId)
          .single()

        if (!originalMessage) throw new Error('Original message not found')

        // Update the support message with response
        const { error } = await supabase
          .from('support_messages')
          .update({
            response: message.text,
            responded_at: new Date().toISOString(),
            responded_by: message.from.username || message.from.first_name, // Capture who responded
            status: 'responded',
            telegram_message_id: message.message_id.toString(),
            is_from_support: true
          })
          .eq('id', originalMessageId)

        if (error) throw error
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 