import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Authorization': '*'
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const bodyText = await req.text()
    console.log('Received webhook body:', bodyText)
    
    const body = JSON.parse(bodyText)
    const { message } = body
    
    console.log('Processing message:', JSON.stringify(message, null, 2))

    if (message?.reply_to_message) {
      console.log('Reply to message text:', message.reply_to_message.text)
      
      const uuidMatch = message.reply_to_message.text.match(/#msg([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
      console.log('UUID match result:', uuidMatch)
      
      if (uuidMatch) {
        const originalMessageId = uuidMatch[1]
        console.log('Found original message UUID:', originalMessageId)

        const { data: originalMessage, error: fetchError } = await supabase
          .from('support_messages')
          .select('id, user_id')
          .eq('id', originalMessageId)
          .single()

        console.log('Database fetch result:', { data: originalMessage, error: fetchError })

        if (fetchError) {
          console.error('Error fetching original message:', fetchError)
          throw fetchError
        }

        if (!originalMessage) {
          console.error('Original message not found for UUID:', originalMessageId)
          throw new Error('Original message not found')
        }

        const updateData = {
          response: message.text,
          responded_at: new Date().toISOString(),
          status: 'resolved',
          telegram_message_id: message.message_id.toString(),
          is_from_support: true
        }
        
        console.log('Attempting to update with data:', updateData)

        const { error: updateError } = await supabase
          .from('support_messages')
          .update(updateData)
          .eq('id', originalMessageId)

        if (updateError) {
          console.error('Error updating message:', updateError)
          throw updateError
        }

        console.log('Successfully processed reply for message:', originalMessageId)
      } else {
        console.log('No valid UUID found in message:', message.reply_to_message.text)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }
}) 