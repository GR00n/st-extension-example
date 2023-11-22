import { extension_settings, getContext,  loadExtensionSettings,ModuleWorkerWrapper, } from "../../../extensions.js";
import {
    power_user,
    renderStoryString,
} from "../../../../scripts/power-user.js";
import { favsToHotswap, getDeviceInfo } from "../../../../scripts/RossAscends-mods.js";
import {
    force_output_sequence,
    formatInstructModeChat,
    formatInstructModePrompt,
    formatInstructModeExamples,
    getInstructStoppingSequences,
    formatInstructModeSystemPrompt,

} from "../../../../scripts/instruct-mode.js";
import { getTokenCount, getTokenizerModel, initTokenizers, saveTokenCache } from "../../../../scripts/tokenizers.js";
import { getCfgPrompt, getGuidanceScale, initCfg } from "../../../../scripts/cfg-scale.js";
import { getExtensionPrompt,replaceBiasMarkup,getBiasStrings,baseChatReplace,getRequestHeaders,addOneMessage,deleteLastMessage,deactivateSendButtons,chat,setSendButtonState, eventSource, event_types,saveSettingsDebounced, saveChat,callPopup, name1, name2, this_chid, characters, chat_metadata} from "../../../../script.js";
import { PromptManagerModule } from '../../../PromptManager.js'
import { getWorldInfoPrompt } from "../../../../scripts/world-info.js";
import { delay , resetScrollHeight } from '../../../utils.js'

const extensionName = "st-extension-example";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

let current_model

const this_max_context = 8000;

let models = [
  {name: 'MythoMax L2 13B',id: 'thebloke/mythomax-l2-13b-gptq',description:'A verbose, creative, and uncensored model. Great for fantasy and adventure scenarios.',context: ''},
  {name: 'Mythalion 13B GGUF',id: 'thebloke/mythalion-13b-gguf',description:`This model was created in collaboration with Gryphe, a mixture of Pygmalion-2 13B and Gryphe's Mythomax L2 13B.`,context: ''},
  {name: 'Nous Hermes Llama2 13b',id: 'nousresearch/nous-hermes-llama2-13b',description:`Smart, capable, and uncensored, this model is best for role-play and coherent conversation.`,context: ''},
  {name: 'Tiefighter 13b',id: 'koboldai/llama2-13b-tiefighter',description:`creative, If you let it improvise you get better results than if you drown it in details.`,context: ''},

]
let chat2 = [];

let coreChat = chat.filter(x => !x.is_system);


for (let i = coreChat.length - 1, j = 0; i >= 0; i--, j++) {
  chat2[i] = formatMessageHistoryItem(coreChat[j], false, false);
}


const generate = async () => {
  try {
    await_message()
    const response = await get_response();
  
    handle_response(response);

  }catch(err){
    handle_error(err)
  }  
}
const await_message = async () => {
  const message = {
    "extra": {
      display_text: '...'
    },
    "name": name2,
    "is_user": false,
    "send_date": getdate(),
    "mes": '...',
  }

  chat.push(message)
  addOneMessage(message)
}

/**
 * send a message as the user to the front end
 * @param {string} text 
 */
const send_as_user = async (text) => {
  const message = {
    "extra": {
      display_text: text
    },
    "name": name1,
    "is_user": true,
    "send_date": getdate(),
    "mes": text
  }
  chat.push(message)
  await eventSource.emit(event_types.MESSAGE_SENT, getContext().chat.length - 1);
  addOneMessage(message)
  await eventSource.emit(event_types.USER_MESSAGE_RENDERED, getContext().chat.length - 1);
  
}
const get_api_request = async () => {
  if (current_model == 'thebloke/mythomax-l2-13b-gptq' || current_model == 'thebloke/mythalion-13b-gguf' || current_model == 'nousresearch/nous-hermes-llama2-13b' || current_model == 'koboldai/llama2-13b-tiefighter'){
    return {
      path: 'generated_text',
      url: 'https://ai.moemate.io/api/chat',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/119.0',
        'webahost': current_model == 'thebloke/mythomax-l2-13b-gptq' ? 'llmmyth.dev.moemate.io' : '' || current_model == 'thebloke/mythalion-13b-gguf' ? 'mythalion.dev.moemate.io' : '' || current_model == 'nousresearch/nous-hermes-llama2-13b' ? 'llmnh2.dev.moemate.io' : '' || current_model == 'koboldai/llama2-13b-tiefighter' ? 'llm2.dev.moemate.io' : '',
        'WebaAuth': 'Bearer',
      },
      body: JSON.stringify({
        inputs: await get_prompt(chat_metadata,getContext().characters,this_chid),
        parameters: {
          best_of: 1,
          decoder_input_details: true,
          details: false,
          do_sample: true,
          max_new_tokens: 500,
          repetition_penalty: 1.15,
          return_full_text: false,
          seed: null,
          stop: getInstructStoppingSequences(),
          stream: true,
          temperature: 0.9,
          top_k: 10,
          top_p: 0.6,
          truncate: null,
          typical_p: 0.99,
          watermark: false
        }
      }),
    }
  }
} 
const handle_status = (status) => {
  if (status === true){
    $('#send_form').removeClass('no_connection')
    $('#ai_settings_drawer').removeClass('no_connection')
    $('#no_connection_icon').hide()
  }else {
    $('#send_form').addClass('no_connection')
    $('#ai_settings_drawer').addClass('no_connection')
    $('#no_connection_icon').show()
  }
}

const api_settings_drawer = async () => {

  $('#top-settings-holder').prepend(
    `<div id="ai_settings_drawer" class="drawer no_connection">
      <div id='api-settings-toggle' class="drawer-toggle">
        <div class="drawer-icon fa-solid fa-server closedIcon" title="API Settings" data-i18n="[title]API Settings"></div>
        <i id='no_connection_icon' class="fa-solid fa-circle-exclamation"></i>
      </div>
     </div`)



  const data = await $.get(`${extensionFolderPath}/html/api_drawer.html`);
  $("#ai_settings_drawer").append(data);

  $('#api-settings-toggle').on('click', function () {
    var icon = $(this).find('.drawer-icon');
    var drawer = $(this).parent().find('.drawer-content');
    if (drawer.hasClass('resizing')) { return }
    var drawerWasOpenAlready = $(this).parent().find('.drawer-content').hasClass('openDrawer');
    let targetDrawerID = $(this).parent().find('.drawer-content').attr('id');
    const pinnedDrawerClicked = drawer.hasClass('pinnedOpen');
  
    if (!drawerWasOpenAlready) { //to open the drawer
        $('.openDrawer').not('.pinnedOpen').addClass('resizing').slideToggle(200, "swing", async function () {
            await delay(50); $(this).closest('.drawer-content').removeClass('resizing');
        });
        $('.openIcon').toggleClass('closedIcon openIcon');
        $('.openDrawer').not('.pinnedOpen').toggleClass('closedDrawer openDrawer');
        icon.toggleClass('openIcon closedIcon');
        drawer.toggleClass('openDrawer closedDrawer');
  
        //console.log(targetDrawerID);
        if (targetDrawerID === 'right-nav-panel') {
            $(this).closest('.drawer').find('.drawer-content').addClass('resizing').slideToggle({
                duration: 200,
                easing: "swing",
                start: function () {
                    jQuery(this).css('display', 'flex'); //flex needed to make charlist scroll
                },
                complete: async function () {
                    favsToHotswap();
                    await delay(50);
                    $(this).closest('.drawer-content').removeClass('resizing');
                    $("#rm_print_characters_block").trigger("scroll");
                }
            })
        } else {
            $(this).closest('.drawer').find('.drawer-content').addClass('resizing').slideToggle(200, "swing", async function () {
                await delay(50); $(this).closest('.drawer-content').removeClass('resizing');
            });
        }
  
        // Set the height of "autoSetHeight" textareas within the drawer to their scroll height
        $(this).closest('.drawer').find('.drawer-content textarea.autoSetHeight').each(function () {
            resetScrollHeight($(this));
        });
  
    } else if (drawerWasOpenAlready) { //to close manually
        icon.toggleClass('closedIcon openIcon');
  
        if (pinnedDrawerClicked) {
            $(drawer).addClass('resizing').slideToggle(200, "swing", async function () {
                await delay(50); $(this).removeClass('resizing');
            });
        }
        else {
            $('.openDrawer').not('.pinnedOpen').addClass('resizing').slideToggle(200, "swing", async function () {
                await delay(50); $(this).closest('.drawer-content').removeClass('resizing');
            });
        }
  
        drawer.toggleClass('closedDrawer openDrawer');
    }
  });
  $('#api_button_connect').on('click' , function(){
    handle_status(true)
  })

  models.forEach(m => {
    $('#model').append(`<option value=${m.id}>${m.name}</option>`)
  })
  const deviceInfo = getDeviceInfo();
  if (deviceInfo && deviceInfo.device.type === 'desktop') {
    // @ts-ignore
      $('#model').select2({
          placeholder: 'Select a model',
          searchInputPlaceholder: 'Search models...',
          searchInputCssClass: 'text_pole',
          width: '100%',
          templateResult: getModelTemplate,
      });
  }
  jQuery(async () => {
    $("#model").on('change' , function(){
      let model = String($(this).val());
  
      current_model = model
    })
  })
}


const get_response = async () => {
  const abortController = new AbortController();

  const { headers,body,url,path } = await get_api_request()

  const args = {
    headers: headers,
    body: body,
  }

  const response = await fetch(url, { signal: abortController.signal, method: 'POST',...args });  
  const data = await response.json()

  if (response.ok) {
    return data[path]
  }else{
    handle_error(response)
  }
}
const handle_response = async (input) => {
  if (chat[chat.length-1].mes == '...' && chat[chat.length-1].is_user == false){
    deleteLastMessage()
  }
  const message = {
    "extra": {
      display_text: await input
    },
    "name": name2,
    "is_user": false,
    "send_date": getdate(),
    "swipe_id:": 0,
    "swipes": [
      {
        "send_date": "November 21, 2023 6:05pm",
        "gen_started": "2023-11-21T18:05:52.068Z",
        "gen_finished": "2023-11-21T18:05:54.535Z",
        "extra": {
          "api": "novel",
          "model": "kayra-v1"
        }
      }
    ],
    "mes": await input,
  }
  chat.push(message)
  await eventSource.emit(event_types.MESSAGE_RECEIVED, getContext().chat.length - 1);
  addOneMessage(message)
  await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, getContext().chat.length - 1);
}
const handle_error = (err) => {
  if (chat[chat.length-1].mes == '...' && chat[chat.length-1].is_user == false){
    deleteLastMessage()
  }
  console.log(err)
  toastr.error(JSON.stringify(err))
}
const handle_abort = () => {
  if (chat[chat.length-1].mes == '...' && chat[chat.length-1].is_user == false){
    deleteLastMessage()
  }
}

const get_prompt = async (chat_metadata, characters, this_chid) => {
  const isInstruct = power_user.instruct.enabled
  let current_chat = ''
  for (const object of getContext().chat) {
    
    current_chat += formatInstructModeChat(object.name, object.mes, object.isUser, object.isNarrator, object.forceAvatar, name1, name2, force_output_sequence.FIRST)

  }
  const textareaText = $("#send_text").val();
  let { messageBias, promptBias, isUserPromptBias } = getBiasStrings(textareaText, 'normal');
  let mesExamples = formatInstructModeExamples(baseChatReplace(characters[this_chid].mes_example.trim(), name1, name2), name1, name2)

  let { worldInfoString, worldInfoBefore, worldInfoAfter, worldInfoDepth } = await getWorldInfoPrompt(chat2, this_max_context);
  const storyStringParams = {
    description: baseChatReplace(characters[this_chid].description.trim(), name1, name2),
    personality: baseChatReplace(characters[this_chid].personality.trim(), name1, name2),
    persona: baseChatReplace(power_user.persona_description.trim(), name1, name2),
    scenario: baseChatReplace(chat_metadata['scenario'] || '', name1, name2),
    system: power_user.prefer_character_prompt ? baseChatReplace(characters[this_chid].data?.system_prompt?.trim(), name1, name2) : '',
    char: name2,
    user: name1,
    wiBefore: worldInfoBefore,
    wiAfter: worldInfoAfter,
    loreBefore: worldInfoBefore,
    loreAfter: worldInfoAfter,
  };

  const storyString = renderStoryString(storyStringParams);
  console.log(storyString)
  return `${storyString}\n${mesExamples}\n${current_chat}\n${formatInstructModePrompt(name2,false,promptBias,name1,name2)}`
}
const onSend = async () => {
  if (getContext().characterId == null){
    toastr.warning('dumbass select a character!')

  }else if ($('#send_form').hasClass('no_connection') || current_model == null) {
    toastr.warning('Select a model first!')
  }else{
    const textarea = $("#send_text");
    const text = textarea.val();
    await send_as_user(String(text));
    textarea.val("");
    generate();
  }
}
const hjack_send = () => {
  $("#send_text").on("keydown", function(event) {
    if (event.keyCode === 13) {
      if (event.shiftKey) {
        const textarea = $(this);
        const cursorPosition = textarea.prop("selectionStart");
        const text = textarea.val;
        // @ts-ignore
        const newText = text.substring(0, cursorPosition) + "\n" + text.substring(cursorPosition);
        textarea.val(newText);
        event.preventDefault();
      } else {
        event.preventDefault();
        onSend();
      }
    }
  })
}
 
jQuery(async () => {
  $("#send_textarea").replaceWith(`<textarea id="send_text" placeholder="Type a message, Enter + Shift for new line" name="text" style="height: 35px;"></textarea>`)
  hjack_send()
  api_settings_drawer()

  $('.option_regenerate').on('click', () => {
    if (chat[chat.length-1].is_user == false){
      deleteLastMessage()
    }    
    generate();
  })

  $(".option_regenerate").replaceWith(`<a class="option_regenerate"><i class="fa-lg fa-solid fa-repeat"></i><span data-i18n="Regenerate">Regenerate</span></a>`)

  $("#option_convert_to_group").hide();
  $("#rm_button_group_chats").hide();
  $("#option_impersonate").hide();
  $("#sys-settings-button").hide();
  $("#option_continue").hide();
  $("#ai-config-button").hide();
});

// function getCombinedPrompt(isNegative) {
//   const cfgGuidanceScale = getGuidanceScale();

//   // Only return if the guidance scale doesn't exist or the value is 1
//   // Also don't return if constructing the neutral prompt
//   if (isNegative && (!cfgGuidanceScale || cfgGuidanceScale?.value === 1)) {
//       return;
//   }

//   // Deep clone
//   let finalMesSend = structuredClone(mesSend);

//   // TODO: Rewrite getExtensionPrompt to not require multiple for loops
//   // Set all extension prompts where insertion depth > mesSend length
//   if (finalMesSend.length) {
//       for (let upperDepth = MAX_INJECTION_DEPTH; upperDepth >= finalMesSend.length; upperDepth--) {
//           const upperAnchor = getExtensionPrompt(extension_prompt_types.IN_CHAT, upperDepth);
//           if (upperAnchor && upperAnchor.length) {
//               finalMesSend[0].extensionPrompts.push(upperAnchor);
//           }
//       }
//   }

//   finalMesSend.forEach((mesItem, index) => {
//       if (index === 0) {
//           return;
//       }

//       const anchorDepth = Math.abs(index - finalMesSend.length);
//       // NOTE: Depth injected here!
//       const extensionAnchor = getExtensionPrompt(extension_prompt_types.IN_CHAT, anchorDepth);

//       if (anchorDepth >= 0 && extensionAnchor && extensionAnchor.length) {
//           mesItem.extensionPrompts.push(extensionAnchor);
//       }
//   });

//   // TODO: Move zero-depth anchor append to work like CFG and bias appends
//   if (zeroDepthAnchor?.length && !isContinue) {
//       console.debug(/\s/.test(finalMesSend[finalMesSend.length - 1].message.slice(-1)))
//       finalMesSend[finalMesSend.length - 1].message +=
//           /\s/.test(finalMesSend[finalMesSend.length - 1].message.slice(-1))
//               ? zeroDepthAnchor
//               : `${zeroDepthAnchor}`;
//   }

//   let cfgPrompt = {};
//   if (cfgGuidanceScale && cfgGuidanceScale?.value !== 1) {
//       cfgPrompt = getCfgPrompt(cfgGuidanceScale, isNegative);
//   }

//   if (cfgPrompt && cfgPrompt?.value) {
//       if (cfgPrompt?.depth === 0) {
//           finalMesSend[finalMesSend.length - 1].message +=
//               /\s/.test(finalMesSend[finalMesSend.length - 1].message.slice(-1))
//                   ? cfgPrompt.value
//                   : ` ${cfgPrompt.value}`;
//       } else {
//           // TODO: Make all extension prompts use an array/splice method
//           const lengthDiff = mesSend.length - cfgPrompt.depth;
//           const cfgDepth = lengthDiff >= 0 ? lengthDiff : 0;
//           finalMesSend[cfgDepth].extensionPrompts.push(`${cfgPrompt.value}\n`);
//       }
//   }

//   // Add prompt bias after everything else
//   // Always run with continue
//   if (!isInstruct && !isImpersonate) {
//       if (promptBias.trim().length !== 0) {
//           finalMesSend[finalMesSend.length - 1].message +=
//               /\s/.test(finalMesSend[finalMesSend.length - 1].message.slice(-1))
//                   ? promptBias.trimStart()
//                   : ` ${promptBias.trimStart()}`;
//       }
//   }

//   // Prune from prompt cache if it exists
//   if (generatedPromptCache.length !== 0) {
//       generatedPromptCache = cleanupPromptCache(generatedPromptCache);
//   }

//   // Right now, everything is suffixed with a newline
//   mesSendString = finalMesSend.map((e) => `${e.extensionPrompts.join('')}${e.message}`).join('');

//   // add chat preamble
//   mesSendString = addChatsPreamble(mesSendString);

//   // add a custom dingus (if defined)
//   mesSendString = addChatsSeparator(mesSendString);

//   let combinedPrompt =
//       beforeScenarioAnchor +
//       storyString +
//       afterScenarioAnchor +
//       mesExmString +
//       mesSendString +
//       generatedPromptCache;

//   combinedPrompt = combinedPrompt.replace(/\r/gm, '');

//   if (power_user.collapse_newlines) {
//       combinedPrompt = collapseNewlines(combinedPrompt);
//   }

//   return combinedPrompt;
// }

function getdate() {
  const currentDateTime = new Date();

  return currentDateTime.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
}
function formatMessageHistoryItem(chatItem, isInstruct, forceOutputSequence) {
  const isNarratorType = false;
  const characterName = chatItem?.name ? chatItem.name : name2;
  const itemName = chatItem.is_user ? chatItem['name'] : characterName;
  const shouldPrependName = !isNarratorType;

  let textResult = shouldPrependName ? `${itemName}: ${chatItem.mes}\n` : `${chatItem.mes}\n`;

  if (isInstruct) {
      textResult = formatInstructModeChat(itemName, chatItem.mes, chatItem.is_user, isNarratorType, chatItem.force_avatar, name1, name2, forceOutputSequence);
  }

  textResult = replaceBiasMarkup(textResult);

  return textResult;
}
function getModelTemplate(option) {
  const model = models.find(x => x.id === option?.element?.value);

  if (!option.id || !model) {
      return option.text;
  }

  return $((`
      <div class="flex-container flexFlowColumn">
          <div><strong>${DOMPurify.sanitize(model.name)}</strong> | <span>${model.context} ctx</span></div>
          <small>${DOMPurify.sanitize(model.description)}</small>
      </div>
  `));
}