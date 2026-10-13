/* bh-bridge-recovery:20261009 — probe immediately, without a timer-driven first ping. */
function BHBridgeHeartbeat(transport, options, types, actors, makeId) {
  return new Promise((resolve, reject) => {
    const id = makeId();
    let finished = false, unsubscribe, timer;
    const complete = error => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { unsubscribe?.(); } catch {}
      if (error) reject(error); else resolve();
    };
    const start = cleanup => {
      unsubscribe = cleanup;
      if (finished) { try { unsubscribe?.(); } catch {} return; }
      timer = setTimeout(() => complete(Error(
        `Provider unavailable: heartbeat check timeout ${options.heartbeatTimeout}ms. [${options.namespace}]`
      )), options.heartbeatTimeout);
      const ping = {type: types.PING, sender: {type: actors.INJECTOR, name: transport.name},
        id, path: [], meta: {}, namespace: options.namespace, timeStamp: Date.now()};
      try {
        transport.debugLog?.({level: "event", method: "sendMessage", message: ping});
        Promise.resolve(transport.sendMessage(ping, [])).catch(complete);
      } catch (error) { complete(error); }
    };
    try {
      const cleanup = transport.onMessage(message => {
        if (message?.namespace === options.namespace && message.sender?.type === actors.PROVIDER &&
            message.type === types.PONG && message.id === id) complete();
      });
      if (cleanup?.then) cleanup.then(start, complete); else start(cleanup);
    } catch (error) { complete(error); }
  });
}
/* end bh-bridge-recovery */
