import"./rolldown-runtime-DAXXjFlN.js";import{Al as e,El as t,Fn as n,Iu as r,Ml as i,Nl as a,Ol as o,Pl as s,Sl as c,Tl as l,Xs as u,Zs as d,a as f,bl as p,i as m,jl as h,kl as g,qn as ee,tl as _,xl as v}from"./app-server-manager-signals-COqz12lX.js";import{Gr as y,Ht as b}from"./src-VylWPNu6.js";import{A as te,Mn as x,sn as ne}from"./src-B6yVM-te.js";import{wn as re}from"./schemas-BXoq17dc.js";import"./index.browser-l-_R1NME.js";import{P as ie}from"./vscode-singleton.browser-BjAZ9ZUo.js";import{d as S,t as C}from"./app-scope-_o3s1Ui4.js";import{c as w}from"./vscode-api-C0hdEJtp.js";import{t as ae}from"./uniqBy-BCWe0yCa.js";import{Ct as T}from"./config-queries-DUP1-2DU.js";import{En as E,c as oe}from"./thread-detail-level-DFryaulP.js";import{t as se}from"./statsig-gate-signal-D9l66S1Q.js";import{x as ce}from"./mcp-app-scope-policy-Bfpfrs90.js";import{A as le,E as ue,S as de,x as fe}from"./thread-workspace-state-CTyn6snG.js";import{n as D,xt as pe}from"./chatgpt-conversation-client-SGs1M8b9.js";import{t as O}from"./chatgpt-conversation-queries-CxGMiWvd.js";import{t as me}from"./remote-ssh-event-logger-rSZPQHfn.js";import{t as he}from"./codex-writing-block-additional-context-CPLAXBiV.js";import{t as ge}from"./read-service-tier-for-request-_h9AHOlg.js";import{d as _e,l as ve,n as k}from"./chatgpt-conversation-composer-state-CjyDzu80.js";import"./chatgpt-consumer-lockdown-Bw1yZGxa.js";import{n as ye}from"./submit-chatgpt-completion-Dz_hL_yE.js";import"./sidebar-queries-DXEXBxvB.js";import"./mcp-sandbox-rpc-DIejdy9w.js";import{t as be}from"./threads-resolve-BZENxval.js";function xe(e,t){let n=e[t];return typeof n==`string`?n:void 0}async function Se(e,t,n,r){if(r.prompt.trim().length===0)throw Error(`Cannot send an empty follow-up message.`);let i=me(e),a=!1,o=null;try{i.trackMessageEvent(t,E.CODEX_REMOTE_SSH_MESSAGE_RESULT_ATTEMPTED,`steer`,{threadId:n}),a=!0;let s=T(e,t),c=e.get(m,t)?.getConversation(n)??null;o=await s.sendFollowUpMessage(n,{...r,writingBlockContextPrepared:c!=null,additionalContext:he(n,c,r.additionalContext)}),i.trackMessageEvent(t,E.CODEX_REMOTE_SSH_MESSAGE_RESULT_SUCCEEDED,`steer`,{threadId:n,turnId:o})}catch(e){throw a&&i.trackMessageEvent(t,E.CODEX_REMOTE_SSH_MESSAGE_RESULT_FAILED,`steer`,{threadId:n,turnId:o}),e}}ae();async function Ce(e,{conversationId:t,messageMetadata:n,parentMessageId:r,prompt:i}){let a=e.get(ue,t),o=le(e.get(fe,t));if(e.get(k,t)||e.get(de,t)||o&&a==null)return!1;let s=e.get(ve,t);e.set(k,t,!0);try{await ye(e,{conversationId:t,isTemporaryChat:!1,messageMetadata:n,model:s.slug,parentMessageId:r,prompt:i,steeringAsyncTaskId:a??void 0,systemHints:e.get(_e,t),thinkingEffort:s.thinkingEffort})}finally{e.set(k,t,!1)}return!0}var we=`chatgpt-thread-list`;S(C,(e,{scope:t})=>({queryFn:()=>t.get(D).list({hideProjectConversations:!1,isArchived:!1,limit:e,order:`updated`}),queryKey:[we,e],staleTime:w.ONE_MINUTE})),S(C,(e,{scope:t})=>({queryFn:({signal:n})=>t.get(D).search({query:e,signal:n}),queryKey:[`chatgpt-thread-search`,e],staleTime:w.THIRTY_SECONDS}));async function Te({scope:e,prompt:t,threadId:n}){let r=await Ee(e,n,!0);if(r==null)return null;if(!await Ce(e,{conversationId:pe(r.conversation_id),prompt:t}))throw Error(`Chat ${n} is already responding.`);return{threadId:n}}async function Ee(e,t,n=!1){let r=e.get(oe,{name:`chatgpt`});if(r.isLoading)throw Error(`Chat history is still loading.`);if(!r.isCapable)return null;try{let r;if(n){let n=await e.get(O,t).refetch();if(n.error!=null)throw n.error;r=n.data}else r=await e.query.getOrFetch(O,t);return r??null}catch(e){if(e instanceof ie&&e.status===404)return null;throw e}}async function De({scope:e,hostId:t,messageMetadata:i,model:a,preferredHostId:o,prompt:s,sourceThreadId:c,threadId:l,thinking:p,turnTrigger:m,toolName:h}){let g=l;if(c!=null&&c!==l&&o!=null&&(t==null||t===o)){let t=e.get(f).find(e=>e.getHostId()===o),n=t?.getConversation(y(c)),r=n?.forkedFromId==null?null:t?.getConversation(n.forkedFromId);n?.sideConversation===!0&&n.forkedFromId!=null&&t!=null&&r!=null&&(r.forkedFromId===y(l)||await ke(e,t,n.forkedFromId,r)===y(l))&&(g=n.forkedFromId)}let _=t;if(_==null)try{_=(await be({scope:e,threadId:g,preferredHostId:o,requestOptions:{timeoutMs:ne}})).hostId}catch(t){let n=await Te({scope:e,prompt:s,threadId:g});if(n!=null)return n;throw t}let v=y(g),b=c==null?s:d({sourceThreadId:c,input:s});if(await Se(e,_,v,{turnTrigger:m,messageMetadata:i,prompt:b,toolOutput:h==null?void 0:u({appServerVersion:e.get(r,_),sourceThreadId:c,input:s,toolName:h}).toolOutput,model:a,reasoningEffort:p,serviceTier:await ge(e,_,a??null),usePermissionSelection:se(e,`4226282475`)||void 0}),c!=null){let t=e.get(ee);if(t.phase===`inactive`)return{threadId:g};let r=t.locator.conversationId,i=y(c),a=r===v?i:r===i?v:null,o=r===v?`from-task`:r===i?`to-task`:null;if(a==null||o==null)return{threadId:g};n({direction:o,hostId:_,message:x(b)?.input??b,realtimeThread:t.locator,threadId:a,threadTitle:Oe(e,a)})}return{threadId:g}}function Oe(e,t){return e.get(f).flatMap(e=>e.getConversation(t)??[]).at(0)?.title??null}async function ke(e,t,n,r){let i=_(r);if(i==null&&(await T(e,t.getHostId()).ensureConversationHistoryLoaded(n),i=_(t.getConversation(n)),i==null))throw Error(`Failed to load complete parent conversation history`);let a=i.at(0)?.params,o=a?.toolOutput?.output,s=typeof o==`string`?[{type:`text`,text:o}]:a?.input??[];for(let e of s){if(e.type!==`text`)continue;let t=x(e.text);if(t!=null)return y(t.sourceThreadId)}return null}var Ae=`(() => {
  const callTool = globalThis.openai?.callTool?.bind(globalThis.openai);
  const panels = new Map();
  const targetIds = new WeakMap();
  let nextPanelId = 0;
  let nextTargetId = 0;
  let stopped = false;
  let command = null;
  let previews = new Map();

  const send = (message) =>
    Promise.resolve()
      .then(() => callTool("__codex_visualization_annotations__", message))
      .catch(() => null);
  const liveTarget = (panel) => {
    const target = panel.target.deref();
    return target?.isConnected && target.ownerDocument === document
      ? target
      : null;
  };

  function owners() {
    const result = new Map();
    for (const panel of panels.values()) {
      const target = liveTarget(panel);
      if (target != null && panel.accepted != null) {
        result.set(target, panel);
      }
    }
    return result;
  }

  function isValue(control, value) {
    switch (control.type) {
      case "range":
        return (
          Number.isFinite(value) && value >= control.min && value <= control.max
        );
      case "color":
        return (
          typeof value === "string" &&
          /^#(?:[\\da-f]{3}|[\\da-f]{4}|[\\da-f]{6}|[\\da-f]{8})$/i.test(value)
        );
      case "toggle":
        return typeof value === "boolean";
      case "select":
        return (
          typeof value === "string" &&
          control.options.some((option) => option.value === value)
        );
      default:
        return false;
    }
  }

  function setValue(binding, value) {
    if (liveTarget(binding.panel) == null) {
      return;
    }
    try {
      if (binding.object[binding.property] === value) {
        return;
      }
      binding.object[binding.property] = value;
      binding.panel.onChange?.();
    } catch (error) {
      globalThis.reportError(error);
    }
  }

  function syncPreviews() {
    const desired = new Map();
    const activeOwners = owners();
    for (const change of command?.changes ?? []) {
      const panel = panels.get(change.registrationId);
      if (
        panel == null ||
        panel.targetId !== change.targetId ||
        activeOwners.get(liveTarget(panel)) !== panel
      ) {
        continue;
      }
      // Globals may precede an update's acknowledgement. Keep accepted previews
      // while adding bindings, without recapturing their edited values.
      if (panel.inFlight) {
        for (const [binding, value] of previews) {
          if (binding.panel === panel) {
            desired.set(binding, value);
          }
        }
        continue;
      }
      for (const edit of change.annotationControlChanges) {
        const binding = panel.bindings.get(edit.callback);
        const control = panel.accepted.find(
          (candidate) => candidate.callback === edit.callback,
        );
        if (
          binding != null &&
          control != null &&
          edit.previousValue === control.currentValue &&
          edit.value !== control.currentValue &&
          isValue(control, edit.value)
        ) {
          desired.set(binding, edit.value);
        }
      }
    }
    const previous = previews;
    previews = desired;
    for (const [binding] of previous) {
      if (previews !== desired) {
        return;
      }
      if (!desired.has(binding)) {
        setValue(binding, binding.control.currentValue);
      }
    }
    for (const [binding, value] of desired) {
      // onChange can synchronously dispose a panel or register another one.
      if (previews !== desired) {
        return;
      }
      if (previous.get(binding) !== value) {
        setValue(binding, value);
      }
    }
  }

  function targetSnapshot(panel) {
    const target = liveTarget(panel);
    if (target == null) {
      throw new TypeError("Tweak container is unavailable");
    }
    const parts = [];
    for (
      let element = target;
      element != null && parts.length < 12;
      element = element.parentElement
    ) {
      const id = element.id && globalThis.CSS?.escape?.(element.id);
      if (id && id.length < 256) {
        parts.unshift(\`#\${id}\`);
        break;
      }
      let index = 1;
      for (
        let sibling = element.previousElementSibling;
        sibling != null;
        sibling = sibling.previousElementSibling
      ) {
        if (sibling.localName === element.localName) {
          index += 1;
        }
      }
      parts.unshift(\`\${element.localName}:nth-of-type(\${index})\`);
    }
    const label = [
      target.getAttribute("aria-label"),
      target.getAttribute("title"),
      target.id,
      target.localName,
    ]
      .map((value) =>
        value
          ?.replace(
            // oxlint-disable-next-line no-control-regex -- Match the host metadata bounds.
            /[\\u0000-\\u001f\\u007f-\\u009f\\u061c\\u200e\\u200f\\u2028-\\u202e\\u2066-\\u2069]/gu,
            " ",
          )
          .replace(/\\s+/g, " ")
          .trim(),
      )
      .find((value) => value);
    const { x, y, width, height } = target.getBoundingClientRect();
    return {
      id: panel.targetId,
      label: label.slice(0, 80),
      selector: parts.join(" > ").slice(0, 1024),
      tagName: target.localName.toLowerCase(),
      rect: { x, y, width, height },
    };
  }

  function dispose(panel) {
    if (panel.disposed) {
      return;
    }
    panel.disposed = true;
    if (panels.delete(panel.id)) {
      syncPreviews();
      void panel.pending.then(() =>
        send({ type: "dispose", registrationId: panel.id }),
      );
    }
    panel.bindings.clear();
    panel.controls = [];
    panel.accepted = null;
  }

  function queue(panel, control, target) {
    panel.pending = panel.pending.then(async () => {
      if (panel.disposed || stopped) {
        return;
      }
      if (liveTarget(panel) == null) {
        dispose(panel);
        return;
      }
      // Rejected bindings must not leak into additions that are already queued.
      const type = panel.accepted == null ? "register" : "update";
      panel.inFlight = true;
      const result = await send({
        type,
        registrationId: panel.id,
        annotationControls: {
          controlsMode: "replace",
          controls: [...(panel.accepted ?? []), control],
        },
        targets: [target],
      });
      panel.inFlight = false;
      if (panel.disposed) {
        return;
      }
      if (Array.isArray(result?.annotationControls?.controls)) {
        panel.accepted = result.annotationControls.controls;
      } else {
        panel.controls = panel.controls.filter(
          (candidate) => candidate.callback !== control.callback,
        );
        panel.bindings.delete(control.callback);
        if (type === "register") {
          dispose(panel);
          return;
        }
      }
      syncPreviews();
    });
  }

  // Object bindings and the sandbox bridge; the host owns all controls UI.
  globalThis.Tweak = class Tweak {
    #panel;
    #disposed = false;

    constructor({ container, onChange }) {
      if (!this.supported) {
        return;
      }
      if (
        !(container instanceof Element) ||
        container.ownerDocument !== document
      ) {
        throw new TypeError("Tweak needs a component element as its container");
      }
      let targetId = targetIds.get(container);
      if (targetId == null) {
        targetId = String(++nextTargetId);
        targetIds.set(container, targetId);
      }
      this.#panel = {
        id: \`tweak-\${++nextPanelId}\`,
        targetId,
        target: new WeakRef(container),
        onChange,
        bindings: new Map(),
        nextControlId: 0,
        controls: [],
        accepted: null,
        pending: Promise.resolve(),
        inFlight: false,
        disposed: false,
      };
    }

    get supported() {
      return callTool != null && !stopped;
    }

    addSlider(
      object,
      property,
      { min, max, step = 1, unit, label, reference } = {},
    ) {
      return this.#bind(object, property, {
        type: "range",
        label: unit ? \`\${label ?? property} (\${unit})\` : (label ?? property),
        reference,
        currentValue: object[property],
        min,
        max,
        step,
      });
    }

    addColorPicker(object, property, { label = property, reference } = {}) {
      return this.#bind(object, property, {
        type: "color",
        label,
        reference,
        currentValue: object[property],
      });
    }

    addToggle(object, property, { label = property, reference } = {}) {
      return this.#bind(object, property, {
        type: "toggle",
        label,
        reference,
        currentValue: object[property],
      });
    }

    addSelect(object, property, { options, label = property, reference }) {
      return this.#bind(object, property, {
        type: "select",
        label,
        reference,
        currentValue: object[property],
        options: options.map((option) =>
          typeof option === "string"
            ? { label: option, value: option }
            : { label: option.label, value: option.value },
        ),
      });
    }

    dispose() {
      this.#disposed = true;
      if (this.#panel != null) {
        dispose(this.#panel);
      }
    }

    #bind(object, property, definition) {
      const panel = this.#panel;
      if (this.#disposed || panel?.disposed) {
        throw new Error("Tweak has been disposed");
      }
      if (!this.supported) {
        return this;
      }
      if (!isValue(definition, definition.currentValue)) {
        throw new TypeError("Tweak bindings require a valid current value");
      }
      if (
        panel.controls.length >= 12 ||
        (!panels.has(panel.id) && panels.size >= 64)
      ) {
        throw new RangeError("Too many Tweak controls");
      }
      const callback = \`\${panel.id}-\${++panel.nextControlId}\`;
      const payload = JSON.stringify({
        controlsMode: "replace",
        controls: [...panel.controls, { ...definition, callback }],
      });
      if (payload.length > 16_384) {
        throw new RangeError("Tweak controls exceed the maximum size");
      }
      const annotationControls = JSON.parse(payload);
      const control = annotationControls.controls.at(-1);
      const target = targetSnapshot(panel);
      panel.controls = annotationControls.controls;
      panel.bindings.set(callback, {
        panel,
        object,
        property,
        control,
      });
      panels.set(panel.id, panel);
      queue(panel, control, target);
      return this;
    }
  };

  function onGlobals(event) {
    const globals = event.detail?.globals;
    if (globals == null || !Object.hasOwn(globals, "visualizationAnnotation")) {
      return;
    }
    const next = globals.visualizationAnnotation;
    if (
      next != null &&
      (typeof next.active !== "boolean" ||
        !Array.isArray(next.changes) ||
        next.changes.length > 1024 ||
        next.changes.some(
          (change) =>
            change == null ||
            typeof change.registrationId !== "string" ||
            typeof change.targetId !== "string" ||
            !Array.isArray(change.annotationControlChanges) ||
            change.annotationControlChanges.length > 12 ||
            change.annotationControlChanges.some(
              (edit) => edit == null || typeof edit.callback !== "string",
            ),
        ))
    ) {
      return;
    }
    command = next;
    syncPreviews();
  }

  function close() {
    command = { ...command, active: false };
    void send({ type: "escape" });
  }

  function onPointerEvent(event) {
    if (!command?.active || event.button !== 0 || event.defaultPrevented) {
      return;
    }
    const activeOwners = owners();
    for (const target of event.composedPath()) {
      const panel = activeOwners.get(target);
      if (panel != null) {
        if (event.type === "click") {
          void send({
            type: "select",
            registrationId: panel.id,
            targetId: panel.targetId,
          });
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    if (event.type === "click") {
      close();
    }
  }

  function onKeyDown(event) {
    if (
      !command?.active ||
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.isComposing
    ) {
      return;
    }
    event.preventDefault();
    close();
  }

  function onPageHide(event) {
    if (!event.isTrusted) {
      return;
    }
    stopped = true;
    command = null;
    syncPreviews();
    for (const panel of panels.values()) {
      dispose(panel);
    }
    observer.disconnect();
    globalThis.removeEventListener("openai:set_globals", onGlobals);
    globalThis.removeEventListener("pointerdown", onPointerEvent, true);
    globalThis.removeEventListener("mousedown", onPointerEvent, true);
    globalThis.removeEventListener("click", onPointerEvent, true);
    globalThis.removeEventListener("keydown", onKeyDown);
    globalThis.removeEventListener("pagehide", onPageHide);
  }

  const observer = new MutationObserver(() => {
    for (const panel of panels.values()) {
      if (liveTarget(panel) == null) {
        if (command?.active && command.selection?.registrationId === panel.id) {
          close();
        }
        dispose(panel);
      }
    }
  });
  if (callTool != null) {
    observer.observe(document, { childList: true, subtree: true });
    globalThis.addEventListener("openai:set_globals", onGlobals);
    globalThis.addEventListener("pointerdown", onPointerEvent, true);
    globalThis.addEventListener("mousedown", onPointerEvent, true);
    globalThis.addEventListener("click", onPointerEvent, true);
    globalThis.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("pagehide", onPageHide);
    onGlobals({ detail: { globals: globalThis.openai } });
  }
})();
`,je=`/* oxlint-disable typescript/no-unsafe-argument, typescript/no-unsafe-call, typescript/no-unsafe-return */
// Runs inside the visualization sandbox, not the host webview.
(() => {
  const capability = "__CODEX_INLINE_VISUALIZATION_DOWNLOAD_CAPABILITY__";
  const callTool = globalThis.openai.callTool.bind(globalThis.openai);
  const anchorClick = Reflect.get(
    globalThis.HTMLAnchorElement.prototype,
    "click",
  );
  globalThis.document.currentScript?.remove();
  let isHandlingTrustedClick = false;
  let didDownload = false;

  const handleDownload = (anchor, event, waitForPropagation) => {
    const isUserActivated =
      event.isTrusted ||
      isHandlingTrustedClick ||
      globalThis.navigator.userActivation?.isActive === true;
    const startDownload = () => {
      if (
        event.defaultPrevented ||
        !isUserActivated ||
        didDownload ||
        !anchor.hasAttribute("download")
      ) {
        return;
      }

      let url;
      try {
        url = new globalThis.URL(anchor.href, globalThis.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "blob:" && url.protocol !== "data:") {
        return;
      }

      const name = anchor.download.trim() || "download";
      didDownload = true;
      void globalThis
        .fetch(url.href)
        .then((response) => response.blob())
        .then((blob) =>
          callTool("__codex_inline_visualization_download__", {
            blob,
            capability,
            name,
          }),
        )
        .catch(() => {});
    };

    if (waitForPropagation) {
      globalThis.queueMicrotask(startDownload);
    } else {
      startDownload();
    }
  };

  globalThis.addEventListener(
    "click",
    (event) => {
      if (event.isTrusted) {
        isHandlingTrustedClick = true;
        didDownload = false;
        globalThis.queueMicrotask(() => {
          isHandlingTrustedClick = false;
        });
      }

      const anchor = event
        .composedPath()
        .find((target) => target instanceof globalThis.HTMLAnchorElement);
      if (anchor != null) {
        handleDownload(anchor, event, true);
      }
    },
    { capture: true },
  );

  globalThis.HTMLAnchorElement.prototype.click = function () {
    let event;
    const observeClick = (clickEvent) => {
      event = clickEvent;
    };
    this.addEventListener("click", observeClick, { capture: true, once: true });
    try {
      return Reflect.apply(anchorClick, this, []);
    } finally {
      this.removeEventListener("click", observeClick, true);
      if (event != null) {
        handleDownload(this, event, false);
      }
    }
  };
})();
`,Me=`<!--__INLINE_VISUALIZATION_FRAGMENT__-->`,Ne=`(() => {
  const root = document.documentElement;
  const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
  const apply = Reflect.apply;
  const isArray = Array.isArray;
  const parentWindow = globalThis.parent;
  /**
   * @param {object} prototype
   * @param {string} property
   */
  const getPrototypeGetter = (prototype, property) => {
    // oxlint-disable-next-line typescript/unbound-method -- invoked through captured Reflect.apply
    const getter = Object.getOwnPropertyDescriptor(prototype, property)?.get;
    if (getter == null) {
      throw new Error(\`Missing \${property} getter\`);
    }
    return getter;
  };
  const getMessageData = getPrototypeGetter(MessageEvent.prototype, "data");
  const getMessagePorts = getPrototypeGetter(MessageEvent.prototype, "ports");
  const getMessageSource = getPrototypeGetter(MessageEvent.prototype, "source");
  // oxlint-disable-next-line typescript/unbound-method -- captured before the untrusted fragment runs
  const addHostMessageListener = MessagePort.prototype.addEventListener;
  // oxlint-disable-next-line typescript/unbound-method -- captured before the untrusted fragment runs
  const postHostMessage = MessagePort.prototype.postMessage;
  // oxlint-disable-next-line typescript/unbound-method -- captured before the untrusted fragment runs
  const startHostPort = MessagePort.prototype.start;
  // oxlint-disable-next-line typescript/unbound-method -- captured before the untrusted fragment runs
  const stopMessagePropagation = Event.prototype.stopImmediatePropagation;
  /** @type {MessagePort | null} */
  let hostPort = null;
  const postToHost = (type, payload) => {
    if (hostPort != null) {
      apply(postHostMessage, hostPort, [{ type, ...payload }]);
    }
  };
  const openExternal = ({ href }) => {
    if (globalThis.navigator.userActivation?.isActive === true) {
      postToHost("open-external", { href });
    }
  };
  const sendFollowUpMessage = ({ context, prompt, title }) => {
    if (globalThis.navigator.userActivation?.isActive === true) {
      postToHost("follow-up", { context, prompt, title });
    }
    return Promise.resolve();
  };
  const syncTheme = () => {
    const theme = mediaQuery.matches ? "dark" : "light";
    root.dataset.theme = theme;
    globalThis.openai = {
      ...globalThis.openai,
      openExternal,
      sendFollowUpMessage,
      theme,
      visualizationStyleVariables: {},
      visualizationTheme: theme,
    };
    globalThis.dispatchEvent(
      new CustomEvent("openai:set_globals", {
        detail: { globals: globalThis.openai },
      }),
    );
  };
  const sendHeight = () => {
    postToHost("height", {
      height: Math.ceil(
        Math.max(
          document.body.scrollHeight,
          document.body.getBoundingClientRect().height,
        ),
      ),
    });
  };

  globalThis.addEventListener(
    "message",
    (event) => {
      const data = apply(getMessageData, event, []);
      const ports = apply(getMessagePorts, event, []);
      const source = apply(getMessageSource, event, []);
      if (
        source !== parentWindow ||
        typeof data !== "object" ||
        data?.type !== "codex-visualization-initialize" ||
        !isArray(ports) ||
        ports.length !== 1
      ) {
        return;
      }
      apply(stopMessagePropagation, event, []);
      const nextHostPort = ports[0];
      try {
        apply(addHostMessageListener, nextHostPort, [
          "message",
          (event) => {
            const data = apply(getMessageData, event, []);
            if (typeof data === "object" && data?.type === "measure") {
              sendHeight();
            }
          },
        ]);
        apply(startHostPort, nextHostPort, []);
      } catch {
        return;
      }
      hostPort = nextHostPort;
      sendHeight();
    },
    { capture: true },
  );
  document.currentScript?.remove();
  mediaQuery.addEventListener("change", syncTheme);
  globalThis.addEventListener("click", (event) => {
    if (event.defaultPrevented) {
      return;
    }
    let element = null;
    if (event.target instanceof globalThis.Element) {
      element = event.target;
    } else if (event.target instanceof globalThis.Node) {
      element = event.target.parentElement;
    }
    const link = element?.closest("a[href]");
    const href = link?.getAttribute("href");
    if (href == null) {
      return;
    }
    if (href.startsWith("#")) {
      let id;
      try {
        id = decodeURIComponent(href.slice(1));
      } catch {
        return;
      }
      const target = id.length === 0 ? root : document.getElementById(id);
      if (
        target == null ||
        globalThis.navigator.userActivation?.isActive !== true
      ) {
        return;
      }
      event.preventDefault();
      postToHost("scroll-to", {
        top: target.getBoundingClientRect().top + globalThis.scrollY,
      });
      return;
    }
    event.preventDefault();
    openExternal({ href });
  });
  new ResizeObserver(sendHeight).observe(document.body);
  syncTheme();
})();
`,Pe=`(() => {
  const frame = document.getElementById("codex-visualization");
  if (!(frame instanceof HTMLIFrameElement)) {
    return;
  }
  let viewportHeight = globalThis.innerHeight;

  const channel = new MessageChannel();
  channel.port1.addEventListener("message", (event) => {
    const data = event.data;
    if (typeof data !== "object" || data == null) {
      return;
    }
    if (data.type === "height") {
      const height = data.height;
      if (
        typeof height === "number" &&
        Number.isFinite(height) &&
        height >= 0 &&
        height <= 10_000
      ) {
        frame.style.height = Math.ceil(height) + "px";
      }
      return;
    }
    if (data.type === "scroll-to") {
      const top = data.top;
      if (
        typeof top === "number" &&
        Number.isFinite(top) &&
        top >= 0 &&
        globalThis.navigator.userActivation?.isActive === true
      ) {
        globalThis.scrollTo({
          top: Math.ceil(
            globalThis.scrollY + frame.getBoundingClientRect().top + top,
          ),
        });
      }
      return;
    }
    if (data.type === "open-external") {
      const rawHref = data.href;
      if (typeof rawHref !== "string") {
        return;
      }
      let href;
      try {
        const url = new URL(rawHref, document.baseURI);
        if (url.protocol !== "https:") {
          return;
        }
        href = url.href;
      } catch {
        return;
      }
      if (globalThis.navigator.userActivation?.isActive === true) {
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.rel = "noopener noreferrer";
        anchor.target = "_blank";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      return;
    }
    if (data.type === "follow-up") {
      const prompt = data.prompt;
      if (
        typeof prompt !== "string" ||
        globalThis.navigator.userActivation?.isActive !== true
      ) {
        return;
      }
      const title = data.title;
      globalThis.prompt(typeof title === "string" ? title : prompt, prompt);
    }
  });
  channel.port1.start();
  const srcdoc = frame.dataset.srcdoc;
  if (srcdoc == null) {
    return;
  }
  globalThis.addEventListener("resize", () => {
    const height = Number.parseFloat(frame.style.height);
    if (!Number.isFinite(height) || height <= viewportHeight) {
      frame.style.removeProperty("height");
    }
    viewportHeight = globalThis.innerHeight;
    channel.port1.postMessage({ type: "measure" });
  });
  frame.addEventListener(
    "load",
    () => {
      frame.contentWindow?.postMessage(
        { type: "codex-visualization-initialize" },
        "*",
        [channel.port2],
      );
    },
    { once: true },
  );
  frame.srcdoc = srcdoc;
  delete frame.dataset.srcdoc;
})();
`,A={"--visualize-paint-gutter":`5px`},Fe={dark:`#83c3ff`,light:`#339cff`},j={dark:[`#f59a56`,`#74d58b`,`#f08fc0`,`#aa91ef`,`#5acbc2`],light:[`#f3883b`,`#5dc977`,`#eb77b1`,`#9b79ec`,`#3ab9b1`]};[...j.light.map((e,t)=>`light-dark(${e}, ${j.dark[t]})`)];var Ie={dark:[`#f08fc0`,`#6aa3ff`,`#74d58b`,`#f59a55`,`#f5d45f`,`#59cbc2`,`#aa91ef`,`#63c7e5`],light:[`#e879b0`,`#4f8df7`,`#62c87a`,`#f08a42`,`#f2c94c`,`#43b8b0`,`#9a7be8`,`#4fbad9`]},M=`light-dark(rgb(255 255 255), rgb(24 24 24))`;function Le(){let e=getComputedStyle(document.documentElement),t=e.colorScheme===`dark`?`dark`:`light`,n=document.createElement(`div`);n.style.display=`none`,n.setAttribute(`aria-hidden`,`true`),document.body.appendChild(n);let r=(t,r,i)=>Re(e,n,t,r,i),i=(e,t)=>r(e,`color`,t),a=(e,t)=>r(e,`backgroundColor`,t);try{let n=a(`--color-surface`,M),o=i(`--color-text`,`light-dark(rgb(26 28 31), rgb(255 255 255))`),s=i(`--color-text-accent`,`light-dark(rgb(51 156 255), rgb(131 195 255))`),c=ze(Be(s)??Fe[t],t),l=j[t],u=r(`--text-base`,`fontSize`,`14px`),d=r(`--radius-lg`,`borderRadius`,`10px`);return{"--accent":a(`--color-background-accent`,`light-dark(rgb(229 242 255), rgb(13 39 63))`),"--accent-foreground":s,"--background":n,"--border":i(`--color-border`,`light-dark(rgb(26 28 31 / 8%), rgb(255 255 255 / 8.2%))`),"--card":`color-mix(in oklab, ${o} 5%, transparent)`,"--card-foreground":o,"--corner-shape":e.getPropertyValue(`--codex-corner-shape`).trim()||`round`,"--destructive":i(`--color-text-warning`,`light-dark(rgb(226 85 7), rgb(255 133 73))`),"--font-mono":r(`--font-mono`,`fontFamily`,`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`),"--font-sans":r(`--font-sans`,`fontFamily`,`-apple-system, system-ui, "Segoe UI", sans-serif`),"--font-size-base":r(`--codex-chat-font-size`,`fontSize`,u),"--foreground":o,"--input":i(`--color-border-primary-outline`,`light-dark(rgb(26 28 31 / 11.8%), color-mix(in oklab, rgb(0 0 0) 10%, transparent))`),"--muted":`color-mix(in srgb, ${o} 10%, transparent)`,"--muted-foreground":i(`--color-codex-description`,`light-dark(rgb(26 28 31 / 49.4%), rgb(255 255 255 / 49.8%))`),"--popover":a(`--color-surface-elevated-secondary`,`light-dark(rgb(255 255 255), rgb(45 45 45))`),"--popover-foreground":i(`--color-text`,o),"--primary":s,"--primary-foreground":i(`--color-text-inverse`,`light-dark(rgb(255 255 255), rgb(13 13 13))`),"--radius":d,"--radius-2xl":r(`--radius-2xl`,`borderRadius`,`16px`),"--radius-lg":d,"--radius-md":r(`--radius-md`,`borderRadius`,`8px`),"--radius-sm":r(`--radius-sm`,`borderRadius`,`6px`),"--ring":i(`--color-ring`,`light-dark(rgb(51 156 255), rgb(131 195 255 / 76%))`),"--secondary":a(`--color-surface-elevated`,`light-dark(rgb(255 255 255 / 96%), rgb(54 54 54 / 96%))`),"--secondary-foreground":o,"--blue":i(`--color-chart-blue`,`light-dark(rgb(51 156 255), rgb(51 156 255))`),"--orange":i(`--color-chart-orange`,`light-dark(rgb(226 85 7), rgb(251 106 34))`),"--green":i(`--color-chart-green`,`light-dark(rgb(0 162 64), rgb(64 201 119))`),"--red":i(`--color-chart-red`,`light-dark(rgb(224 46 42), rgb(255 103 100))`),"--purple":i(`--color-chart-purple`,`light-dark(rgb(146 79 247), rgb(173 123 249))`),"--yellow":i(`--color-chart-yellow`,`light-dark(rgb(255 195 0), rgb(255 210 64))`),...A,"--viz-series-1":s,"--viz-series-2":c[0]??l[0],"--viz-series-3":c[1]??l[1],"--viz-series-4":c[2]??l[2],"--viz-series-5":c[3]??l[3],"--viz-series-6":c[4]??l[4]}}finally{n.remove()}}function Re(e,t,n,r,i){let a=e.getPropertyValue(n).trim();if(a.length===0)return i;t.style[r]=`var(${n})`;let o=getComputedStyle(t)[r].trim();return o.length>0&&o!==`var(${n})`&&!o.includes(`var(`)?o:a.includes(`var(`)?i:a}function ze(e,t){let n=N(e),r=.96+I((n.chroma-.06)/.16,0,1)*.12,i=Ie[t].map(N).map(e=>({...e,chroma:e.chroma*r}));return He([...i.filter(e=>F(e.hue,n.hue)>=30),...i.filter(e=>F(e.hue,n.hue)<30)],n.hue).map(Ve)}function Be(e){let t=e.trim().match(/^#([\da-f]{6})(?:[\da-f]{2})?$/i)?.[1];if(t!=null)return`#${t.toLowerCase()}`;let n=e.trim().match(/^rgba?\((.*)\)$/i)?.[1],r=e.trim().match(/^color\(\s*srgb\s+(.*)\)$/i)?.[1],i=(n??r)?.split(`/`)[0]?.trim().split(/[,\s]+/).filter(Boolean).slice(0,3).map(Number);if(i?.length!==3||i.some(Number.isNaN))return null;let a=r==null?1:255;return`#${i.map(e=>Math.round(I(e*a,0,255)).toString(16).padStart(2,`0`)).join(``)}`}function N(e){let t=e=>e<=.04045?e/12.92:((e+.055)/1.055)**2.4,n=t(Number.parseInt(e.slice(1,3),16)/255),r=t(Number.parseInt(e.slice(3,5),16)/255),i=t(Number.parseInt(e.slice(5,7),16)/255),a=.4122214708*n+.5363325363*r+.0514459929*i,o=.2119034982*n+.6806995451*r+.1073969566*i,s=.0883024619*n+.2817188376*r+.6299787005*i,c=Math.cbrt(a),l=Math.cbrt(o),u=Math.cbrt(s),d=.2104542553*c+.793617785*l-.0040720468*u,f=1.9779984951*c-2.428592205*l+.4505937099*u,p=.0259040371*c+.7827717662*l-.808675766*u;return{chroma:Math.hypot(f,p),hue:(Math.atan2(p,f)*180/Math.PI+360)%360,lightness:d}}function P({chroma:e,hue:t,lightness:n}){let r=t*Math.PI/180,i=e*Math.cos(r),a=e*Math.sin(r),o=n+.3963377774*i+.2158037573*a,s=n-.1055613458*i-.0638541728*a,c=n-.0894841775*i-1.291485548*a,l=o**3,u=s**3,d=c**3,f=e=>e<=.0031308?12.92*e:1.055*e**(1/2.4)-.055;return[f(4.0767416621*l-3.3077115913*u+.2309699292*d),f(-1.2684380046*l+2.6097574011*u-.3413193965*d),f(-.0041960863*l-.7034186147*u+1.707614701*d)]}function Ve(e){let t={...e};for(;!P(t).every(e=>e>=-1e-4&&e<=1.0001)&&t.chroma>.005;)t.chroma*=.96;return`#${P(t).map(e=>Math.round(I(e,0,1)*255).toString(16).padStart(2,`0`)).join(``)}`}function He(e,t){let n=[];for(;n.length<5&&e.length>0;){let r=0,i=-1;e.forEach((e,a)=>{let o=Math.min(F(e.hue,t),...n.map(t=>F(e.hue,t.hue)));o>i&&(i=o,r=a)});let[a]=e.splice(r,1);a!=null&&n.push(a)}return n}function F(e,t){return Math.min(Math.abs(e-t),360-Math.abs(e-t))}function I(e,t,n){return Math.max(t,Math.min(n,e))}function L(e,t){return t||=e.slice(0),Object.freeze(Object.defineProperties(e,{raw:{value:Object.freeze(t)}}))}var Ue,We,Ge,Ke,qe,R=`__codex_inline_visualization_error__`,z=`__codex_inline_visualization_click__`,Je=`__codex_inline_visualization_download__`,B=`__codex_inline_visualization_hover__`,V=`__codex_inline_visualization_height__`,Ye=`<style id="codex-visualization-document-overflow">html,body{overflow-y:hidden!important}</style>`,Xe=`<style id="codex-visualization-document-scrollbar">html,body{scrollbar-width:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important}</style>`,Ze=`<!--__INLINE_VISUALIZATION_FRAGMENT__-->`,Qe=`__CODEX_INLINE_VISUALIZATION_DOWNLOAD_CAPABILITY__`,$e=String.raw(Ue||=L([`<script>
(() => {
  const reportEnvironmentError = (value) => {
    const error = value instanceof Error ? value : new Error(String(value));
    void globalThis.openai
      .callTool(
        "`,`",
        {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
      )
      .catch(() => {});
  };

  globalThis.addEventListener("error", (event) => {
    reportEnvironmentError(event.error ?? event.message);
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    reportEnvironmentError(event.reason);
  });
})();
<\/script>`]),R),et=String.raw(We||=L([`<script>
(() => {
  let isHovering = false;
  let isTouch = false;
  const reportHover = (nextIsHovering, nextIsTouch = false) => {
    if (nextIsHovering === isHovering && nextIsTouch === isTouch) {
      return;
    }
    isHovering = nextIsHovering;
    isTouch = nextIsTouch;
    void globalThis.openai
      .callTool(
        "`,`",
        isTouch ? { isHovering, pointerType: "touch" } : { isHovering },
      )
      .catch(() => {});
  };

  globalThis.addEventListener(
    "pointerover",
    (event) =>
      reportHover(event.pointerType !== "touch", event.pointerType === "touch"),
    { capture: true },
  );
  globalThis.addEventListener(
    "pointerout",
    (event) => {
      if (event.pointerType !== "touch" && event.relatedTarget == null) {
        reportHover(false);
      }
    },
    { capture: true },
  );
})();
<\/script>`]),B),tt=String.raw(Ge||=L([`<script>
globalThis.addEventListener(
  "click",
  () => {
    void globalThis.openai
      .callTool("`,`", {})
      .catch(() => {});
  },
  { capture: true },
);
<\/script>`]),z),nt=String.raw(Ke||=L([`<script>
(() => {
  const contentRange = document.createRange();
  let previousMeasurement = null;
  let animationFrame = null;
  const reportHeight = () => {
    const bodyChildren = Array.from(document.body.children).filter(
      (element) =>
        element.tagName !== "SCRIPT" &&
        element.tagName !== "STYLE" &&
        element.getAttribute("role") !== "tooltip",
    );
    let contentHeight;
    if (bodyChildren.length === 0) {
      contentRange.selectNodeContents(document.body);
      contentHeight = contentRange.getBoundingClientRect().height;
    } else if (bodyChildren.length === 1) {
      const [bodyChild] = bodyChildren;
      contentHeight = Math.max(
        bodyChild.scrollHeight,
        bodyChild.getBoundingClientRect().height,
      );
    } else {
      const bodyTop = document.body.getBoundingClientRect().top;
      contentHeight = Math.max(
        ...bodyChildren.map(
          (bodyChild) => bodyChild.getBoundingClientRect().bottom - bodyTop,
        ),
      );
    }
    const viewportHeight = globalThis.innerHeight;
    const previous = previousMeasurement;
    previousMeasurement = { contentHeight, viewportHeight };
    if (
      previous != null &&
      contentHeight - previous.contentHeight ===
        viewportHeight - previous.viewportHeight
    ) {
      return;
    }

    void globalThis.openai
      .callTool(
        "`,`",
        contentHeight,
      )
      .catch(() => {});
  };
  const scheduleHeightReport = () => {
    if (animationFrame != null) {
      return;
    }
    animationFrame = globalThis.requestAnimationFrame(() => {
      animationFrame = null;
      reportHeight();
    });
  };

  const resizeObserver = new ResizeObserver(scheduleHeightReport);
  const observeBodyChildren = () => {
    for (const element of document.body.children) {
      resizeObserver.observe(element);
    }
  };
  resizeObserver.observe(document.body);
  observeBodyChildren();
  new MutationObserver(() => {
    observeBodyChildren();
    scheduleHeightReport();
  }).observe(document.body, { childList: true });
  globalThis.addEventListener("resize", scheduleHeightReport);
  reportHeight();
})();
<\/script>`]),V),rt=String.raw(qe||=L([`<script>
(() => {
  const root = document.documentElement;
  const initialGlobals =
    globalThis.__codexVisualizationInitialGlobals ?? globalThis.openai;
  delete globalThis.__codexVisualizationInitialGlobals;
  let appliedProperties = [];

  const applyHostStyleVariables = (styleVariables) => {
    if (styleVariables == null || typeof styleVariables !== "object") {
      return;
    }
    for (const property of appliedProperties) {
      root.style.removeProperty(property);
    }
    appliedProperties = [];
    for (const [property, value] of Object.entries(styleVariables)) {
      if (property.startsWith("--") && typeof value === "string") {
        root.style.setProperty(property, value);
        appliedProperties.push(property);
      }
    }
  };

  const syncHostStyles = (globals) => {
    applyHostStyleVariables(globals?.visualizationStyleVariables);
    const sandboxDocument = globalThis.frameElement?.ownerDocument;
    if (sandboxDocument != null && globals?.visualizationTheme != null) {
      let colorSchemeMeta = sandboxDocument.querySelector(
        'meta[name="color-scheme"]',
      );
      if (colorSchemeMeta == null) {
        colorSchemeMeta = sandboxDocument.createElement("meta");
        colorSchemeMeta.name = "color-scheme";
        sandboxDocument.head.appendChild(colorSchemeMeta);
      }
      colorSchemeMeta.content = globals.visualizationTheme;
      sandboxDocument.documentElement.style.colorScheme =
        globals.visualizationTheme;
      // Paint the host surface behind transparent saved visualization documents.
      sandboxDocument.documentElement.style.backgroundColor =
        root.style.getPropertyValue("--background");
    }
  };

  syncHostStyles(initialGlobals);
  globalThis.addEventListener("openai:set_globals", (event) => {
    syncHostStyles(event.detail?.globals);
  });
})();
<\/script>`])),H=[`blob:`,`data:`,`https://cdnjs.cloudflare.com`,`https://cdn.jsdelivr.net`,`https://esm.sh`,`https://fonts.bunny.net`,`https://fonts.googleapis.com`,`https://fonts.gstatic.com`,`https://unpkg.com`],U=H.join(` `),W=[`default-src 'none'`,`script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' ${U}`,`style-src 'unsafe-inline' ${U}`,`img-src ${U}`,`font-src ${U}`,`media-src ${U}`,`worker-src blob:`,`connect-src blob: data:`,`frame-src 'none'`,`object-src 'none'`,`base-uri 'none'`,`form-action 'none'`].join(`; `),it=W.replace(`frame-src 'none'`,`frame-src 'self'`),G={baseUriDomains:[],connectDomains:[`blob:`,`data:`],frameDomains:[],includeDefaultDomains:!1,isTrusted:!0,resourceDomains:H};function K(e,{allowAnnotations:t=!1,initialGlobals:n,downloadCapability:r,innerKit:i=Me,lockDocumentOverflow:a=!0,reportToHost:o=!0,styles:s=`:root {
  color-scheme: light dark;
  background-color: var(
    --background,
    var(--color-background-primary, light-dark(rgb(255 255 255), rgb(24 24 24)))
  ) !important;

  /* Agent-facing contract; keep in sync with SKILL.md. */
  --background: var(
    --color-background-primary,
    light-dark(rgb(255 255 255), rgb(24 24 24))
  );
  --foreground: var(
    --color-text-primary,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --card: color-mix(in oklab, var(--foreground) 5%, var(--background));
  --card-foreground: var(
    --color-text-primary,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --popover: var(
    --color-background-secondary,
    light-dark(rgb(255 255 255), rgb(45 45 45))
  );
  --popover-foreground: var(
    --color-text-primary,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --primary: var(
    --color-text-info,
    light-dark(rgb(51 156 255), rgb(131 195 255))
  );
  --primary-foreground: var(
    --color-text-inverse,
    light-dark(rgb(255 255 255), rgb(13 13 13))
  );
  --secondary: var(
    --color-background-secondary,
    light-dark(rgb(255 255 255 / 96%), rgb(54 54 54 / 96%))
  );
  --secondary-foreground: var(
    --color-text-primary,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --muted: color-mix(in srgb, var(--foreground) 10%, transparent);
  --muted-foreground: var(
    --color-text-secondary,
    light-dark(rgb(26 28 31 / 49.4%), rgb(255 255 255 / 49.8%))
  );
  --accent: var(
    --color-background-info,
    light-dark(rgb(229 242 255), rgb(13 39 63))
  );
  --accent-foreground: var(
    --color-text-info,
    light-dark(rgb(51 156 255), rgb(131 195 255))
  );
  --destructive: var(
    --color-text-warning,
    light-dark(rgb(226 85 7), rgb(255 133 73))
  );
  --border: var(
    --color-border-secondary,
    light-dark(rgb(26 28 31 / 8%), rgb(255 255 255 / 8.2%))
  );
  --input: var(
    --color-border-primary,
    light-dark(
      rgb(26 28 31 / 11.8%),
      color-mix(in oklab, rgb(0 0 0) 10%, transparent)
    )
  );
  --ring: var(
    --color-ring-primary,
    light-dark(rgb(51 156 255), rgb(131 195 255 / 76%))
  );
  --font-size-base: var(--font-text-md-size, 14px);
  --blue: light-dark(rgb(51 156 255), rgb(51 156 255));
  --orange: light-dark(rgb(226 85 7), rgb(251 106 34));
  --green: light-dark(rgb(0 162 64), rgb(64 201 119));
  --red: light-dark(rgb(224 46 42), rgb(255 103 100));
  --purple: light-dark(rgb(146 79 247), rgb(173 123 249));
  --yellow: light-dark(rgb(255 195 0), rgb(255 210 64));
  --viz-series-1: var(--primary);
  --viz-series-2: light-dark(rgb(243 136 59), rgb(245 154 86));
  --viz-series-3: light-dark(rgb(93 201 119), rgb(116 213 139));
  --viz-series-4: light-dark(rgb(235 119 177), rgb(240 143 192));
  --viz-series-5: light-dark(rgb(155 121 236), rgb(170 145 239));
  --viz-series-6: light-dark(rgb(58 185 177), rgb(90 203 194));

  /* Internal implementation variables; not part of the agent contract. */
  --font-sans: -apple-system, system-ui, "Segoe UI", sans-serif;
  --font-mono:
    ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace;
  --font-size-normal: max(11px, var(--font-size-base));
  --font-size-tooltip: calc(var(--font-size-base) - 1px);
  --font-size-small: max(11px, calc(var(--font-size-base) - 2px));
  --font-size-h1: calc(var(--font-size-normal) * 1.7142857143);
  --font-size-h2: calc(var(--font-size-normal) * 1.4285714286);
  --font-size-h3: calc(var(--font-size-normal) * 1.2857142857);
  --font-weight-normal: 430;
  --font-weight-medium: 500;
  --icon-size: 16px;
  --line-height-normal: calc(var(--font-size-normal) * 1.5);
  --line-height-tooltip: calc(var(--font-size-tooltip) * 1.4285714286);
  --line-height-small: calc(var(--font-size-small) + 4px);
  --corner-shape: round;
  --radius: var(--border-radius-lg, 10px);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-2xl: calc(var(--radius) * 1.6);
  --radius-full: 9999px;
  --shadow-sm: 0 1px 2px -1px rgb(0 0 0 / 8%);
  --checkmark-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 17 17'%3E%3Cpath d='M12.8961 3.64101C13.1297 3.41418 13.4984 3.37523 13.7779 3.56581C14.0571 3.75635 14.1554 4.11331 14.0299 4.41347L13.9615 4.53847L7.71151 13.7045C7.59411 13.8767 7.4063 13.9877 7.19881 14.0072C6.99136 14.0267 6.78564 13.9533 6.63826 13.806L2.88826 10.056L2.79842 9.9457C2.6192 9.67407 2.64927 9.30496 2.88826 9.06581C3.12738 8.82669 3.49647 8.79676 3.76815 8.97597L3.8785 9.06581L7.03084 12.2182L12.8053 3.74941L12.8961 3.64101Z'/%3E%3C/svg%3E");

  /* Legacy aliases; not part of the current agent contract. */
  --viz-bg: transparent;
  --viz-panel: var(--card);
  --viz-border: var(--border);
  --viz-text: var(--foreground);
  --viz-muted: var(--muted-foreground);
  --viz-accent: var(--primary);
  --viz-accent-text: var(--primary-foreground);
  --viz-accent-bg: var(--accent);
  --viz-font-size: var(--font-size-base);
  --viz-warning: var(--destructive);
}

:root[data-theme="light"] {
  color-scheme: light;
}

:root[data-theme="dark"] {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html > body {
  /* Preserve MCP aliases for older inline renderers without creating :root cycles. */
  --color-background-primary: var(
    --background,
    light-dark(rgb(255 255 255), rgb(24 24 24))
  );
  --color-text-primary: var(
    --foreground,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --color-border-secondary: var(
    --border,
    light-dark(rgb(26 28 31 / 8%), rgb(255 255 255 / 8.2%))
  );

  margin: 0;
  padding: var(--visualize-paint-gutter, 0px);
  color: var(--foreground);
  background: transparent !important;
  font-family: var(--font-sans) !important;
  font-size: var(--font-size-normal);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
}

a {
  color: color-mix(in srgb, var(--viz-accent) 80%, var(--viz-text) 20%);
  cursor: pointer;
  font-weight: var(--font-weight-medium, 500);
  text-decoration: none;
  text-underline-offset: 2px;
}

a:is(:hover, :focus-visible) {
  text-decoration-line: underline;
  text-decoration-style: dashed;
  text-decoration-thickness: 0.5px;
}

h1,
h2,
h3,
h4,
h5,
h6,
p {
  margin-block: 0;
}

h1 {
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
}

h2 {
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
}

h3,
h4,
h5,
h6 {
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
}

b,
strong,
th {
  font-weight: var(--font-weight-medium);
}

code:not(pre code) {
  display: inline;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  corner-shape: var(--corner-shape);
  background: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.92em;
  overflow-wrap: anywhere;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  word-break: break-word;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
}

.table {
  width: 100%;
  border-collapse: collapse;
  color: var(--foreground);
  font: inherit;
  text-align: start;
}

.table :is(th, td) {
  padding-block: 10px;
  padding-inline: 0 24px;
  overflow-wrap: anywhere;
  border-bottom: 1px solid var(--border);
  text-align: start;
  vertical-align: top;
}

.table-responsive > .table :is(th, td) {
  overflow-wrap: break-word;
}

.table :is(th, td):last-child {
  padding-inline-end: 0;
}

.table :is(caption, thead th) {
  font-weight: 600;
}

.table thead th {
  padding-block: 8px;
  border-bottom-color: color-mix(in srgb, var(--foreground) 16%, transparent);
}

.table tbody tr:last-child :is(th, td) {
  border-bottom: 0;
}

.table.table-sm :is(th, td) {
  padding-block: 6px;
}

.table.table-sm :is(th, td):not(:last-child) {
  padding-inline-end: 16px;
}

.table :is(.text-end, [align="right"]) {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.table :is(.text-center, [align="center"]) {
  text-align: center;
}

.table .text-nowrap {
  white-space: nowrap;
}

#widget {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 0;
  background: transparent !important;
}

.card {
  min-width: 0;
  padding: 12px;
  overflow: hidden;
  overflow-wrap: break-word;
  border-radius: var(--radius-2xl);
  corner-shape: var(--corner-shape);
  color: var(--card-foreground);
  background: var(--card);
}

#widget > :not(.card, .progress) {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.tooltip {
  position: fixed;
  z-index: 50;
  top: 0;
  left: 0;
  width: max-content;
  max-width: min(
    20rem,
    var(--tooltip-available-width, calc(100vw - 10px)),
    calc(100vw - 10px)
  );
  max-height: min(
    var(--tooltip-available-height, calc(100vh - 10px)),
    calc(100vh - 10px)
  );
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  corner-shape: var(--corner-shape);
  color: var(--popover-foreground);
  background: var(--popover);
  box-shadow: none;
  font-size: var(--font-size-tooltip);
  line-height: var(--line-height-tooltip);
  overflow-wrap: break-word;
  white-space: normal;
  pointer-events: none;
  user-select: none;
}

.viz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(max(180px, 24%), 1fr));
  gap: 10px;
}

.viz-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.viz-stat-value {
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
}

.viz-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

hr {
  width: 100%;
  height: 1px;
  margin-block: 6px;
  border: 0;
  background: var(--border);
}

.nav {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.progress {
  display: flex;
  height: 8px;
  margin-block: calc((var(--line-height-normal, 1.5em) - 8px) / 2);
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--muted);
}

.progress-bar:only-child {
  border-radius: var(--radius-full);
}

.progress-bar {
  height: 100%;
  flex-shrink: 0;
  border: 0;
  background: var(--viz-series-1);
}

.viz-badge {
  padding: 3px 8px;
  border-radius: var(--radius-full);
  color: var(--accent-foreground);
  background: var(--accent);
  font-weight: var(--font-weight-medium);
}

small,
.text-small,
.viz-badge {
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}

.text-muted {
  color: var(--muted-foreground);
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.viz-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.viz-controls > .form-label {
  display: grid;
  min-width: min(100%, 260px);
  flex: 1 1 280px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 2px 12px;
  margin-bottom: 0;
}

.viz-controls > .form-label > :is(.form-control, .form-range, .form-select) {
  grid-column: 1 / -1;
}

.btn,
.nav-link,
.form-check-input,
.form-control,
.form-range,
.form-select {
  font: inherit;
}

.btn,
.nav-link {
  appearance: button;
  display: inline-flex;
  inline-size: fit-content;
  max-inline-size: 100%;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 0 8px;
  -webkit-app-region: no-drag;
  border: 1px solid var(--input);
  border-radius: var(--radius-lg);
  corner-shape: var(--corner-shape);
  color: var(--secondary-foreground);
  background: var(--secondary);
  cursor: var(--cursor-interaction, pointer);
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

.btn:is(.btn-block, .viz-tile) {
  inline-size: 100%;
}

.btn.viz-tile {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

a.btn {
  cursor: pointer;
  text-decoration: none;
}

.btn:not(:disabled):hover,
.nav-link:not(:disabled):not([aria-disabled="true"]):hover {
  background: color-mix(in srgb, var(--foreground) 6%, var(--secondary));
}

.btn-primary {
  border-color: transparent;
  color: var(--primary-foreground);
  background: var(--foreground);
  background-clip: padding-box;
}

.btn-primary .text-muted {
  color: color-mix(in srgb, var(--primary-foreground) 50%, transparent);
}

.btn-primary:not(:disabled):hover {
  background: color-mix(in srgb, var(--foreground) 80%, transparent);
  background-clip: padding-box;
}

.btn-ghost {
  border-color: transparent;
  color: var(--muted-foreground);
  background: transparent;
}

.btn-ghost:not(:disabled):hover {
  color: var(--foreground);
  background: color-mix(in srgb, var(--foreground) 6%, var(--secondary));
}

.nav-pills .nav-link {
  min-width: 0;
  border-color: transparent;
  color: var(--muted-foreground);
  background: transparent;
}

.nav-justified .nav-link {
  flex: 1 1 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.nav-pills .nav-link.active {
  color: var(--foreground);
  background: var(--muted);
}

.btn:disabled,
.nav-link:disabled,
.nav-link[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.4;
}

[data-lucide] {
  stroke-width: 1.6;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  color: var(--foreground);
}

.form-control {
  display: block;
  width: 100%;
  min-height: 28px;
  padding: 0 8px;
  outline: none;
  border: 1px solid var(--input);
  border-radius: var(--radius-lg);
  corner-shape: var(--corner-shape);
  color: var(--foreground);
  background: var(--secondary);
}

.form-control::placeholder {
  color: var(--muted-foreground);
}

.form-control[type="file"] {
  padding: 0;
  overflow: hidden;
  cursor: var(--cursor-interaction, pointer);
}

.form-control[type="file"]::file-selector-button {
  min-height: 26px;
  margin-right: 8px;
  padding: 0 8px;
  border: 0;
  border-right: 1px solid var(--input);
  color: var(--secondary-foreground);
  background: var(--secondary);
  cursor: inherit;
  font: inherit;
}

.form-control[type="file"]:not(:disabled):hover::file-selector-button {
  background: color-mix(in srgb, var(--foreground) 6%, var(--secondary));
}

.form-control-color[type="color"] {
  width: 40px;
  height: 28px;
  padding: 3px;
  cursor: var(--cursor-interaction, pointer);
}

.form-control-color[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

.form-control-color[type="color"]::-webkit-color-swatch {
  border: 0;
  border-radius: calc(var(--radius-lg) - 4px);
  corner-shape: var(--corner-shape);
}

textarea.form-control {
  height: auto;
  min-height: 72px;
  padding: 8px 10px;
  resize: vertical;
}

.form-control:focus-visible {
  border-color: var(--ring);
  box-shadow: inset 0 0 0 1px var(--ring);
}

.form-control:disabled,
.form-select:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.form-select {
  appearance: none;
  display: block;
  width: 100%;
  min-height: 28px;
  margin: 0;
  padding: 0 32px 0 8px;
  outline: none;
  border: 1px solid var(--input);
  border-radius: var(--radius-lg);
  corner-shape: var(--corner-shape);
  color: var(--foreground);
  background-color: var(--secondary);
  background-image:
    linear-gradient(45deg, transparent 50%, var(--muted-foreground) 50%),
    linear-gradient(135deg, var(--muted-foreground) 50%, transparent 50%);
  background-position:
    calc(100% - 14px) 50%,
    calc(100% - 10px) 50%;
  background-repeat: no-repeat;
  background-size: 4px 4px;
  cursor: var(--cursor-interaction, default);
}

.form-select:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--foreground) 6%, var(--secondary));
}

.form-select:focus-visible {
  border-color: var(--ring);
  box-shadow: inset 0 0 0 1px var(--ring);
}

.form-check {
  display: flex;
  min-height: 20px;
  align-items: center;
  gap: 6px;
}

.form-check-input {
  appearance: none;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  margin: 0;
  border: 1px solid var(--input);
  color: var(--primary-foreground);
  background-color: transparent;
  cursor: var(--cursor-interaction, default);
  transition:
    background-color 150ms,
    border-color 150ms,
    box-shadow 150ms;
}

.form-check:not(.form-switch) .form-check-input[type="checkbox"] {
  border-color: var(--input);
  border-radius: var(--radius-sm);
  corner-shape: var(--corner-shape);
  background-color: var(--secondary);
  box-shadow: var(--shadow-sm);
}

.form-check:not(.form-switch)
  .form-check-input:not(:disabled):not(:checked):hover {
  background-color: var(--card);
}

.form-check:not(.form-switch) .form-check-input[type="checkbox"]:checked {
  border-color: var(--primary);
  background-color: var(--primary);
}

.form-check:not(.form-switch)
  .form-check-input[type="checkbox"]:checked::before {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--primary-foreground);
  content: "";
  mask: var(--checkmark-image) center / 12px 12px no-repeat;
}

.form-check-input[type="radio"] {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
}

.form-check-input[type="radio"]:checked {
  border: 2px solid var(--primary);
  background:
    radial-gradient(circle, var(--primary-foreground) 0 2.5px, transparent 3px),
    var(--primary);
}

.form-check:not(.form-switch) .form-check-input:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.form-check:not(.form-switch) .form-check-input:disabled {
  cursor: not-allowed;
  pointer-events: none;
}

.form-check:not(.form-switch) .form-check-input:disabled + .form-check-label {
  cursor: not-allowed;
}

.form-switch .form-check-input:disabled,
.form-switch .form-check-input:disabled + .form-check-label {
  cursor: not-allowed;
  opacity: 0.6;
}

.form-check-label {
  color: var(--foreground);
  cursor: var(--cursor-interaction, default);
}

.form-switch .form-check-input {
  position: relative;
  width: 32px;
  height: 20px;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--muted);
  box-shadow: none;
  transition: background-color 200ms cubic-bezier(0, 0, 0.2, 1);
}

.form-switch .form-check-input::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 1px solid light-dark(var(--primary-foreground), var(--foreground));
  border-radius: var(--radius-full);
  background: light-dark(var(--primary-foreground), var(--foreground));
  box-shadow: var(--shadow-sm);
  content: "";
  transform: translate(2px, -50%);
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
}

.form-switch .form-check-input:checked {
  background: var(--primary);
}

.form-switch .form-check-input:checked::before {
  transform: translate(14px, -50%);
}

.form-switch .form-check-input:focus-visible {
  box-shadow: 0 0 0 2px var(--ring);
}

.form-range {
  appearance: none;
  display: block;
  width: 100%;
  height: 28px;
  flex: 1;
  margin: 0;
  padding: 0;
  outline: none;
  border: 0;
  accent-color: var(--primary);
  background: linear-gradient(
      color-mix(in srgb, var(--foreground) 7%, transparent),
      color-mix(in srgb, var(--foreground) 7%, transparent)
    )
    center / 100% 2px no-repeat;
}

.form-range::-webkit-slider-runnable-track {
  height: 28px;
  background: transparent;
}

.form-range::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: light-dark(var(--primary-foreground), var(--foreground));
}

.form-range:focus-visible::-webkit-slider-thumb {
  border-color: var(--ring);
  box-shadow: inset 0 0 0 1px var(--ring);
}

.form-range::-moz-range-track {
  height: 28px;
  background: transparent;
}

.form-range::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: light-dark(var(--primary-foreground), var(--foreground));
}

.form-range:focus-visible::-moz-range-thumb {
  border-color: var(--ring);
  box-shadow: inset 0 0 0 1px var(--ring);
}

.form-range:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.btn:not(.btn-primary, .viz-tile):is(
  [aria-pressed="true"],
  [aria-selected="true"],
  .is-selected
) {
  border-color: var(--primary);
  color: var(--primary-foreground);
  background: var(--primary);
}

.btn.viz-tile:is([aria-pressed="true"], [aria-selected="true"], .is-selected) {
  border-color: var(--primary);
  box-shadow: inset 0 0 0 1px var(--primary);
}

.btn:focus-visible,
.nav-link:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

@media (pointer: coarse) {
  .btn,
  .nav-link,
  .form-control,
  .form-select {
    min-width: 44px;
    min-height: 44px;
  }

  /* Keep small-screen WebKit from zooming when a text field receives focus. */
  .form-control,
  .form-select {
    font-size: max(16px, var(--font-size-normal));
  }

  .form-control[type="file"]::file-selector-button {
    min-width: 44px;
    min-height: 44px;
  }

  .form-control-color[type="color"] {
    width: 44px;
    height: 44px;
  }

  .form-control:is(
    [type="date"],
    [type="datetime-local"],
    [type="month"],
    [type="time"],
    [type="week"]
  ) {
    min-width: 0;
    max-width: 100%;
    padding-block: 8px;
  }

  .form-check {
    min-height: 44px;
    padding-inline: 15px;
  }

  .form-check-input {
    position: relative;
  }

  .form-check-input::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    content: "";
    transform: translate(-50%, -50%);
  }

  .form-check-label {
    display: inline-flex;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
  }

  .form-range {
    height: 44px;
    touch-action: pan-y;
  }

  .form-range::-webkit-slider-runnable-track {
    height: 44px;
  }

  .form-range::-moz-range-track {
    height: 44px;
  }

  .form-range::-webkit-slider-thumb {
    margin-top: 12px;
  }
}

svg {
  display: block;
  max-width: 100%;
  height: auto;
}

#widget > svg {
  width: 100%;
}

/* Model-authored chart rules can otherwise stretch icons after these styles load. */
svg.lucide {
  display: block;
  width: var(--icon-size) !important;
  height: var(--icon-size) !important;
  flex: none;
  margin: 0 !important;
  stroke-width: 1.6;
}

.text-warning,
.text-destructive {
  color: var(--destructive);
}
`}={}){let c=n==null?``:`<script>globalThis.__codexVisualizationInitialGlobals=${JSON.stringify(n).replaceAll(`<`,`\\u003c`)};<\/script>\n`,l=o&&r!=null?`\n${ot(r)}`:``,u=o?`${$e}\n${et}\n${tt}${l}`:``;return`<style>${s}</style>
${i.replace(Ze,()=>`${c}${rt}
${u}
${o&&t?`<script>${Ae.replaceAll(`<\/script`,`<\\/script`)}<\/script>`:``}
${e}
${o?nt:``}
${Xe}
${a?Ye:``}`)}`}function at(e,{locale:t,styles:n=`:root {
  color-scheme: light dark;
  background-color: var(
    --background,
    var(--color-background-primary, light-dark(rgb(255 255 255), rgb(24 24 24)))
  ) !important;

  /* Agent-facing contract; keep in sync with SKILL.md. */
  --background: var(
    --color-background-primary,
    light-dark(rgb(255 255 255), rgb(24 24 24))
  );
  --foreground: var(
    --color-text-primary,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --card: color-mix(in oklab, var(--foreground) 5%, var(--background));
  --card-foreground: var(
    --color-text-primary,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --popover: var(
    --color-background-secondary,
    light-dark(rgb(255 255 255), rgb(45 45 45))
  );
  --popover-foreground: var(
    --color-text-primary,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --primary: var(
    --color-text-info,
    light-dark(rgb(51 156 255), rgb(131 195 255))
  );
  --primary-foreground: var(
    --color-text-inverse,
    light-dark(rgb(255 255 255), rgb(13 13 13))
  );
  --secondary: var(
    --color-background-secondary,
    light-dark(rgb(255 255 255 / 96%), rgb(54 54 54 / 96%))
  );
  --secondary-foreground: var(
    --color-text-primary,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --muted: color-mix(in srgb, var(--foreground) 10%, transparent);
  --muted-foreground: var(
    --color-text-secondary,
    light-dark(rgb(26 28 31 / 49.4%), rgb(255 255 255 / 49.8%))
  );
  --accent: var(
    --color-background-info,
    light-dark(rgb(229 242 255), rgb(13 39 63))
  );
  --accent-foreground: var(
    --color-text-info,
    light-dark(rgb(51 156 255), rgb(131 195 255))
  );
  --destructive: var(
    --color-text-warning,
    light-dark(rgb(226 85 7), rgb(255 133 73))
  );
  --border: var(
    --color-border-secondary,
    light-dark(rgb(26 28 31 / 8%), rgb(255 255 255 / 8.2%))
  );
  --input: var(
    --color-border-primary,
    light-dark(
      rgb(26 28 31 / 11.8%),
      color-mix(in oklab, rgb(0 0 0) 10%, transparent)
    )
  );
  --ring: var(
    --color-ring-primary,
    light-dark(rgb(51 156 255), rgb(131 195 255 / 76%))
  );
  --font-size-base: var(--font-text-md-size, 14px);
  --blue: light-dark(rgb(51 156 255), rgb(51 156 255));
  --orange: light-dark(rgb(226 85 7), rgb(251 106 34));
  --green: light-dark(rgb(0 162 64), rgb(64 201 119));
  --red: light-dark(rgb(224 46 42), rgb(255 103 100));
  --purple: light-dark(rgb(146 79 247), rgb(173 123 249));
  --yellow: light-dark(rgb(255 195 0), rgb(255 210 64));
  --viz-series-1: var(--primary);
  --viz-series-2: light-dark(rgb(243 136 59), rgb(245 154 86));
  --viz-series-3: light-dark(rgb(93 201 119), rgb(116 213 139));
  --viz-series-4: light-dark(rgb(235 119 177), rgb(240 143 192));
  --viz-series-5: light-dark(rgb(155 121 236), rgb(170 145 239));
  --viz-series-6: light-dark(rgb(58 185 177), rgb(90 203 194));

  /* Internal implementation variables; not part of the agent contract. */
  --font-sans: -apple-system, system-ui, "Segoe UI", sans-serif;
  --font-mono:
    ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace;
  --font-size-normal: max(11px, var(--font-size-base));
  --font-size-tooltip: calc(var(--font-size-base) - 1px);
  --font-size-small: max(11px, calc(var(--font-size-base) - 2px));
  --font-size-h1: calc(var(--font-size-normal) * 1.7142857143);
  --font-size-h2: calc(var(--font-size-normal) * 1.4285714286);
  --font-size-h3: calc(var(--font-size-normal) * 1.2857142857);
  --font-weight-normal: 430;
  --font-weight-medium: 500;
  --icon-size: 16px;
  --line-height-normal: calc(var(--font-size-normal) * 1.5);
  --line-height-tooltip: calc(var(--font-size-tooltip) * 1.4285714286);
  --line-height-small: calc(var(--font-size-small) + 4px);
  --corner-shape: round;
  --radius: var(--border-radius-lg, 10px);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-2xl: calc(var(--radius) * 1.6);
  --radius-full: 9999px;
  --shadow-sm: 0 1px 2px -1px rgb(0 0 0 / 8%);
  --checkmark-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 17 17'%3E%3Cpath d='M12.8961 3.64101C13.1297 3.41418 13.4984 3.37523 13.7779 3.56581C14.0571 3.75635 14.1554 4.11331 14.0299 4.41347L13.9615 4.53847L7.71151 13.7045C7.59411 13.8767 7.4063 13.9877 7.19881 14.0072C6.99136 14.0267 6.78564 13.9533 6.63826 13.806L2.88826 10.056L2.79842 9.9457C2.6192 9.67407 2.64927 9.30496 2.88826 9.06581C3.12738 8.82669 3.49647 8.79676 3.76815 8.97597L3.8785 9.06581L7.03084 12.2182L12.8053 3.74941L12.8961 3.64101Z'/%3E%3C/svg%3E");

  /* Legacy aliases; not part of the current agent contract. */
  --viz-bg: transparent;
  --viz-panel: var(--card);
  --viz-border: var(--border);
  --viz-text: var(--foreground);
  --viz-muted: var(--muted-foreground);
  --viz-accent: var(--primary);
  --viz-accent-text: var(--primary-foreground);
  --viz-accent-bg: var(--accent);
  --viz-font-size: var(--font-size-base);
  --viz-warning: var(--destructive);
}

:root[data-theme="light"] {
  color-scheme: light;
}

:root[data-theme="dark"] {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html > body {
  /* Preserve MCP aliases for older inline renderers without creating :root cycles. */
  --color-background-primary: var(
    --background,
    light-dark(rgb(255 255 255), rgb(24 24 24))
  );
  --color-text-primary: var(
    --foreground,
    light-dark(rgb(26 28 31), rgb(255 255 255))
  );
  --color-border-secondary: var(
    --border,
    light-dark(rgb(26 28 31 / 8%), rgb(255 255 255 / 8.2%))
  );

  margin: 0;
  padding: var(--visualize-paint-gutter, 0px);
  color: var(--foreground);
  background: transparent !important;
  font-family: var(--font-sans) !important;
  font-size: var(--font-size-normal);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
}

a {
  color: color-mix(in srgb, var(--viz-accent) 80%, var(--viz-text) 20%);
  cursor: pointer;
  font-weight: var(--font-weight-medium, 500);
  text-decoration: none;
  text-underline-offset: 2px;
}

a:is(:hover, :focus-visible) {
  text-decoration-line: underline;
  text-decoration-style: dashed;
  text-decoration-thickness: 0.5px;
}

h1,
h2,
h3,
h4,
h5,
h6,
p {
  margin-block: 0;
}

h1 {
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
}

h2 {
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
}

h3,
h4,
h5,
h6 {
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
}

b,
strong,
th {
  font-weight: var(--font-weight-medium);
}

code:not(pre code) {
  display: inline;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  corner-shape: var(--corner-shape);
  background: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.92em;
  overflow-wrap: anywhere;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  word-break: break-word;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
}

.table {
  width: 100%;
  border-collapse: collapse;
  color: var(--foreground);
  font: inherit;
  text-align: start;
}

.table :is(th, td) {
  padding-block: 10px;
  padding-inline: 0 24px;
  overflow-wrap: anywhere;
  border-bottom: 1px solid var(--border);
  text-align: start;
  vertical-align: top;
}

.table-responsive > .table :is(th, td) {
  overflow-wrap: break-word;
}

.table :is(th, td):last-child {
  padding-inline-end: 0;
}

.table :is(caption, thead th) {
  font-weight: 600;
}

.table thead th {
  padding-block: 8px;
  border-bottom-color: color-mix(in srgb, var(--foreground) 16%, transparent);
}

.table tbody tr:last-child :is(th, td) {
  border-bottom: 0;
}

.table.table-sm :is(th, td) {
  padding-block: 6px;
}

.table.table-sm :is(th, td):not(:last-child) {
  padding-inline-end: 16px;
}

.table :is(.text-end, [align="right"]) {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.table :is(.text-center, [align="center"]) {
  text-align: center;
}

.table .text-nowrap {
  white-space: nowrap;
}

#widget {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 0;
  background: transparent !important;
}

.card {
  min-width: 0;
  padding: 12px;
  overflow: hidden;
  overflow-wrap: break-word;
  border-radius: var(--radius-2xl);
  corner-shape: var(--corner-shape);
  color: var(--card-foreground);
  background: var(--card);
}

#widget > :not(.card, .progress) {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.tooltip {
  position: fixed;
  z-index: 50;
  top: 0;
  left: 0;
  width: max-content;
  max-width: min(
    20rem,
    var(--tooltip-available-width, calc(100vw - 10px)),
    calc(100vw - 10px)
  );
  max-height: min(
    var(--tooltip-available-height, calc(100vh - 10px)),
    calc(100vh - 10px)
  );
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  corner-shape: var(--corner-shape);
  color: var(--popover-foreground);
  background: var(--popover);
  box-shadow: none;
  font-size: var(--font-size-tooltip);
  line-height: var(--line-height-tooltip);
  overflow-wrap: break-word;
  white-space: normal;
  pointer-events: none;
  user-select: none;
}

.viz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(max(180px, 24%), 1fr));
  gap: 10px;
}

.viz-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.viz-stat-value {
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-medium);
  line-height: 1.25;
}

.viz-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

hr {
  width: 100%;
  height: 1px;
  margin-block: 6px;
  border: 0;
  background: var(--border);
}

.nav {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.progress {
  display: flex;
  height: 8px;
  margin-block: calc((var(--line-height-normal, 1.5em) - 8px) / 2);
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--muted);
}

.progress-bar:only-child {
  border-radius: var(--radius-full);
}

.progress-bar {
  height: 100%;
  flex-shrink: 0;
  border: 0;
  background: var(--viz-series-1);
}

.viz-badge {
  padding: 3px 8px;
  border-radius: var(--radius-full);
  color: var(--accent-foreground);
  background: var(--accent);
  font-weight: var(--font-weight-medium);
}

small,
.text-small,
.viz-badge {
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}

.text-muted {
  color: var(--muted-foreground);
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.viz-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.viz-controls > .form-label {
  display: grid;
  min-width: min(100%, 260px);
  flex: 1 1 280px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 2px 12px;
  margin-bottom: 0;
}

.viz-controls > .form-label > :is(.form-control, .form-range, .form-select) {
  grid-column: 1 / -1;
}

.btn,
.nav-link,
.form-check-input,
.form-control,
.form-range,
.form-select {
  font: inherit;
}

.btn,
.nav-link {
  appearance: button;
  display: inline-flex;
  inline-size: fit-content;
  max-inline-size: 100%;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 0 8px;
  -webkit-app-region: no-drag;
  border: 1px solid var(--input);
  border-radius: var(--radius-lg);
  corner-shape: var(--corner-shape);
  color: var(--secondary-foreground);
  background: var(--secondary);
  cursor: var(--cursor-interaction, pointer);
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

.btn:is(.btn-block, .viz-tile) {
  inline-size: 100%;
}

.btn.viz-tile {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

a.btn {
  cursor: pointer;
  text-decoration: none;
}

.btn:not(:disabled):hover,
.nav-link:not(:disabled):not([aria-disabled="true"]):hover {
  background: color-mix(in srgb, var(--foreground) 6%, var(--secondary));
}

.btn-primary {
  border-color: transparent;
  color: var(--primary-foreground);
  background: var(--foreground);
  background-clip: padding-box;
}

.btn-primary .text-muted {
  color: color-mix(in srgb, var(--primary-foreground) 50%, transparent);
}

.btn-primary:not(:disabled):hover {
  background: color-mix(in srgb, var(--foreground) 80%, transparent);
  background-clip: padding-box;
}

.btn-ghost {
  border-color: transparent;
  color: var(--muted-foreground);
  background: transparent;
}

.btn-ghost:not(:disabled):hover {
  color: var(--foreground);
  background: color-mix(in srgb, var(--foreground) 6%, var(--secondary));
}

.nav-pills .nav-link {
  min-width: 0;
  border-color: transparent;
  color: var(--muted-foreground);
  background: transparent;
}

.nav-justified .nav-link {
  flex: 1 1 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.nav-pills .nav-link.active {
  color: var(--foreground);
  background: var(--muted);
}

.btn:disabled,
.nav-link:disabled,
.nav-link[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.4;
}

[data-lucide] {
  stroke-width: 1.6;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  color: var(--foreground);
}

.form-control {
  display: block;
  width: 100%;
  min-height: 28px;
  padding: 0 8px;
  outline: none;
  border: 1px solid var(--input);
  border-radius: var(--radius-lg);
  corner-shape: var(--corner-shape);
  color: var(--foreground);
  background: var(--secondary);
}

.form-control::placeholder {
  color: var(--muted-foreground);
}

.form-control[type="file"] {
  padding: 0;
  overflow: hidden;
  cursor: var(--cursor-interaction, pointer);
}

.form-control[type="file"]::file-selector-button {
  min-height: 26px;
  margin-right: 8px;
  padding: 0 8px;
  border: 0;
  border-right: 1px solid var(--input);
  color: var(--secondary-foreground);
  background: var(--secondary);
  cursor: inherit;
  font: inherit;
}

.form-control[type="file"]:not(:disabled):hover::file-selector-button {
  background: color-mix(in srgb, var(--foreground) 6%, var(--secondary));
}

.form-control-color[type="color"] {
  width: 40px;
  height: 28px;
  padding: 3px;
  cursor: var(--cursor-interaction, pointer);
}

.form-control-color[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

.form-control-color[type="color"]::-webkit-color-swatch {
  border: 0;
  border-radius: calc(var(--radius-lg) - 4px);
  corner-shape: var(--corner-shape);
}

textarea.form-control {
  height: auto;
  min-height: 72px;
  padding: 8px 10px;
  resize: vertical;
}

.form-control:focus-visible {
  border-color: var(--ring);
  box-shadow: inset 0 0 0 1px var(--ring);
}

.form-control:disabled,
.form-select:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.form-select {
  appearance: none;
  display: block;
  width: 100%;
  min-height: 28px;
  margin: 0;
  padding: 0 32px 0 8px;
  outline: none;
  border: 1px solid var(--input);
  border-radius: var(--radius-lg);
  corner-shape: var(--corner-shape);
  color: var(--foreground);
  background-color: var(--secondary);
  background-image:
    linear-gradient(45deg, transparent 50%, var(--muted-foreground) 50%),
    linear-gradient(135deg, var(--muted-foreground) 50%, transparent 50%);
  background-position:
    calc(100% - 14px) 50%,
    calc(100% - 10px) 50%;
  background-repeat: no-repeat;
  background-size: 4px 4px;
  cursor: var(--cursor-interaction, default);
}

.form-select:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--foreground) 6%, var(--secondary));
}

.form-select:focus-visible {
  border-color: var(--ring);
  box-shadow: inset 0 0 0 1px var(--ring);
}

.form-check {
  display: flex;
  min-height: 20px;
  align-items: center;
  gap: 6px;
}

.form-check-input {
  appearance: none;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  margin: 0;
  border: 1px solid var(--input);
  color: var(--primary-foreground);
  background-color: transparent;
  cursor: var(--cursor-interaction, default);
  transition:
    background-color 150ms,
    border-color 150ms,
    box-shadow 150ms;
}

.form-check:not(.form-switch) .form-check-input[type="checkbox"] {
  border-color: var(--input);
  border-radius: var(--radius-sm);
  corner-shape: var(--corner-shape);
  background-color: var(--secondary);
  box-shadow: var(--shadow-sm);
}

.form-check:not(.form-switch)
  .form-check-input:not(:disabled):not(:checked):hover {
  background-color: var(--card);
}

.form-check:not(.form-switch) .form-check-input[type="checkbox"]:checked {
  border-color: var(--primary);
  background-color: var(--primary);
}

.form-check:not(.form-switch)
  .form-check-input[type="checkbox"]:checked::before {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--primary-foreground);
  content: "";
  mask: var(--checkmark-image) center / 12px 12px no-repeat;
}

.form-check-input[type="radio"] {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
}

.form-check-input[type="radio"]:checked {
  border: 2px solid var(--primary);
  background:
    radial-gradient(circle, var(--primary-foreground) 0 2.5px, transparent 3px),
    var(--primary);
}

.form-check:not(.form-switch) .form-check-input:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.form-check:not(.form-switch) .form-check-input:disabled {
  cursor: not-allowed;
  pointer-events: none;
}

.form-check:not(.form-switch) .form-check-input:disabled + .form-check-label {
  cursor: not-allowed;
}

.form-switch .form-check-input:disabled,
.form-switch .form-check-input:disabled + .form-check-label {
  cursor: not-allowed;
  opacity: 0.6;
}

.form-check-label {
  color: var(--foreground);
  cursor: var(--cursor-interaction, default);
}

.form-switch .form-check-input {
  position: relative;
  width: 32px;
  height: 20px;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--muted);
  box-shadow: none;
  transition: background-color 200ms cubic-bezier(0, 0, 0.2, 1);
}

.form-switch .form-check-input::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 1px solid light-dark(var(--primary-foreground), var(--foreground));
  border-radius: var(--radius-full);
  background: light-dark(var(--primary-foreground), var(--foreground));
  box-shadow: var(--shadow-sm);
  content: "";
  transform: translate(2px, -50%);
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
}

.form-switch .form-check-input:checked {
  background: var(--primary);
}

.form-switch .form-check-input:checked::before {
  transform: translate(14px, -50%);
}

.form-switch .form-check-input:focus-visible {
  box-shadow: 0 0 0 2px var(--ring);
}

.form-range {
  appearance: none;
  display: block;
  width: 100%;
  height: 28px;
  flex: 1;
  margin: 0;
  padding: 0;
  outline: none;
  border: 0;
  accent-color: var(--primary);
  background: linear-gradient(
      color-mix(in srgb, var(--foreground) 7%, transparent),
      color-mix(in srgb, var(--foreground) 7%, transparent)
    )
    center / 100% 2px no-repeat;
}

.form-range::-webkit-slider-runnable-track {
  height: 28px;
  background: transparent;
}

.form-range::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: light-dark(var(--primary-foreground), var(--foreground));
}

.form-range:focus-visible::-webkit-slider-thumb {
  border-color: var(--ring);
  box-shadow: inset 0 0 0 1px var(--ring);
}

.form-range::-moz-range-track {
  height: 28px;
  background: transparent;
}

.form-range::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: light-dark(var(--primary-foreground), var(--foreground));
}

.form-range:focus-visible::-moz-range-thumb {
  border-color: var(--ring);
  box-shadow: inset 0 0 0 1px var(--ring);
}

.form-range:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.btn:not(.btn-primary, .viz-tile):is(
  [aria-pressed="true"],
  [aria-selected="true"],
  .is-selected
) {
  border-color: var(--primary);
  color: var(--primary-foreground);
  background: var(--primary);
}

.btn.viz-tile:is([aria-pressed="true"], [aria-selected="true"], .is-selected) {
  border-color: var(--primary);
  box-shadow: inset 0 0 0 1px var(--primary);
}

.btn:focus-visible,
.nav-link:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

@media (pointer: coarse) {
  .btn,
  .nav-link,
  .form-control,
  .form-select {
    min-width: 44px;
    min-height: 44px;
  }

  /* Keep small-screen WebKit from zooming when a text field receives focus. */
  .form-control,
  .form-select {
    font-size: max(16px, var(--font-size-normal));
  }

  .form-control[type="file"]::file-selector-button {
    min-width: 44px;
    min-height: 44px;
  }

  .form-control-color[type="color"] {
    width: 44px;
    height: 44px;
  }

  .form-control:is(
    [type="date"],
    [type="datetime-local"],
    [type="month"],
    [type="time"],
    [type="week"]
  ) {
    min-width: 0;
    max-width: 100%;
    padding-block: 8px;
  }

  .form-check {
    min-height: 44px;
    padding-inline: 15px;
  }

  .form-check-input {
    position: relative;
  }

  .form-check-input::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    content: "";
    transform: translate(-50%, -50%);
  }

  .form-check-label {
    display: inline-flex;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
  }

  .form-range {
    height: 44px;
    touch-action: pan-y;
  }

  .form-range::-webkit-slider-runnable-track {
    height: 44px;
  }

  .form-range::-moz-range-track {
    height: 44px;
  }

  .form-range::-webkit-slider-thumb {
    margin-top: 12px;
  }
}

svg {
  display: block;
  max-width: 100%;
  height: auto;
}

#widget > svg {
  width: 100%;
}

/* Model-authored chart rules can otherwise stretch icons after these styles load. */
svg.lucide {
  display: block;
  width: var(--icon-size) !important;
  height: var(--icon-size) !important;
  flex: none;
  margin: 0 !important;
  stroke-width: 1.6;
}

.text-warning,
.text-destructive {
  color: var(--destructive);
}
`,title:r}){let i=`<!doctype html>
<html lang="${q(t)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="${W}">
<title>${q(r)}</title>
</head>
<body>
<script>${Ne.replaceAll(`<\/script`,`<\\/script`)}<\/script>
${K(e,{lockDocumentOverflow:!1,reportToHost:!1,styles:`${n}\nhtml>body{padding:0}`})}
</body>
</html>
`;return`<!doctype html>
<html lang="${q(t)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="${it}">
<title>${q(r)}</title>
<style>:root{color-scheme:light dark;background:${M}}html,body{margin:0}body{box-sizing:border-box;padding:1rem;background:inherit}iframe{display:block;width:100%;max-width:736px;height:calc(100vh - 2rem);margin:0 auto;border:0}</style>
</head>
<body>
<iframe id="codex-visualization" sandbox="allow-scripts" scrolling="no" referrerpolicy="no-referrer" title="${q(r)}" data-srcdoc="${q(i)}"></iframe>
<script>${Pe.replaceAll(`<\/script`,`<\\/script`)}<\/script>
</body>
</html>
`}function q(e){return e.replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`).replaceAll(`>`,`&gt;`).replaceAll(`"`,`&quot;`)}function ot(e){return`<script>${je.replace(JSON.stringify(Qe),JSON.stringify(e).replaceAll(`<`,`\\u003c`)).replaceAll(`<\/script`,`<\\/script`)}<\/script>`}var st=10,J=1e4,ct=re().nonnegative().transform(e=>Math.min(Math.ceil(e),J));function lt({locale:e,scopeId:t,scheme:n}){return b({locale:e,scheme:n,subdomain:`codex-inline-visualization-${ce(t)}`})}async function*ut({allowAnnotations:e=!1,allowInteractions:t,canExpand:n,downloadCapability:r,fragment:i,locale:a,lockDocumentOverflow:o,maxHeight:s,maxWidth:c,sandboxApi:l,signal:u,styles:d,styleVariables:f}){let p=X();for await(let m of l.runWidgetCode({csp:G,displayMode:`inline`,features:[],hostHandlesFollowUpMessageAuthorization:!0,html:K(i,{allowAnnotations:e,downloadCapability:r,initialGlobals:{visualizationStyleVariables:f,visualizationTheme:p},lockDocumentOverflow:o,styles:d}),isFirstParty:!1,isSidebarOpen:!1,isTombstone:!1,maxHeight:s,maxWidth:c,measureWidth:!1,mcpApps:{hostCapabilities:t?{openLinks:{},message:{},sandbox:{csp:G}}:{sandbox:{csp:G}},hostContext:Y(c,a,p,s,n,`inline`),hostInfo:{name:`chatgpt`}},safeArea:Z(),theme:p,toolInput:null,toolOutput:null,toolResponseMetadata:null,userAgent:Q(),viewParams:null,widgetId:crypto.randomUUID(),widgetState:null})){if(u.aborted)return;yield m}}async function dt({canExpand:e,contentWidth:t,displayMode:n,locale:r,maxHeight:i,sandboxApi:a,styleVariables:o,theme:s}){await Promise.all([a.setTheme({theme:s}),a.setAdditionalGlobals({additionalGlobals:{maxHeight:i,maxWidth:t,visualizationStyleVariables:o,visualizationTheme:s}}),a.notifyMcpAppsHostContext({hostContext:Y(t,r,s,i,e,n)})])}function Y(e,t,n,r,i,a){let o=Q();return{availableDisplayModes:i?[`inline`,`fullscreen`]:[`inline`],containerDimensions:{maxHeight:r,maxWidth:e},deviceCapabilities:o.capabilities,displayMode:a,locale:t,platform:`desktop`,safeAreaInsets:Z().insets,theme:n,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,userAgent:`chatgpt`}}function X(){return getComputedStyle(document.documentElement).colorScheme===`dark`?`dark`:`light`}function Z(){return{insets:{bottom:0,left:0,right:0,top:0}}}function Q(){return{capabilities:{hover:window.matchMedia?.(`(any-hover: hover)`)?.matches||window.matchMedia?.(`(hover: hover)`)?.matches||!1,touch:window.matchMedia?.(`(any-pointer: coarse)`)?.matches||window.matchMedia?.(`(pointer: coarse)`)?.matches||!1},device:{os:ft(),platform:`native`,type:`desktop`}}}function ft(){let e=window.navigator.platform.toLowerCase();return e.includes(`mac`)?`macos`:e.includes(`win`)?`windows`:`unknown`}function pt(){return{[p]:$,[v]:$,[c]:$,[te]:$,[l]:$,[t]:$,[i]:$,[o]:$,[g]:$,[h]:$,[e]:$,[a]:$,[s]:$}}function $(){return null}export{De as _,X as a,ct as c,R as d,V as f,Le as g,A as h,lt as i,z as l,at as m,st as n,ut as o,B as p,J as r,dt as s,pt as t,Je as u,xe as v};