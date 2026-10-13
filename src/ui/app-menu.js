I({
  __name: 'PersonalAppMenu',
  setup() {
    const toasts = Fm();
    const dialogs = RX();
    const welcomeOpen = N(false);
    const container = N();
    const menuItems = [[{label: BHProject.name}], [{
      label: '版本信息',
      onSelect: () => dialogs.create(wQ, {destroyOnClose: true}).open(),
    }, {
      label: '项目仓库',
      onSelect: () => window.open(BHProject.repository, '_blank', 'noopener'),
    }, {
      label: '问题反馈',
      onSelect: () => window.open(BHProject.feedback, '_blank', 'noopener'),
    }]];
    async function acceptWelcome() {
      await iu.storageSet(e4, t4);
      welcomeOpen.value = false;
    }
    Ai(async () => {
      Md.info(BHProject.name + '已加载');
      toasts.add({description: BHProject.name + '已加载', duration: 2000});
      welcomeOpen.value = await iu.storageGet(e4) !== t4;
    });
    return () => {
      R();
      return z('div', {ref: container, class: 'fixed top-18 right-10 z-999'}, [
        H(BX, {portal: container.value, toaster: {position: 'top-right', ui: {viewport: 'z-100000'}}}, {
          default: F(() => [
            H(XZ, {items: menuItems}, {default: F(() => [
              H(uX, {size: 'xs', src: BHProject.logo, alt: BHProject.shortName,
                class: 'border-2 border-amber-50 hover:border-amber-200 cursor-pointer'}),
            ]), _: 1}),
            H(hQ, {title: BHProject.name, open: welcomeOpen.value,
              'onUpdate:open': value => { welcomeOpen.value = value; }}, {
              body: F(() => [V('div', {class: 'space-y-3 select-text'}, [
                V('p', null, '这是你的个人维护版，版本、反馈和后续维护以自己的项目仓库为准。'),
                V('p', null, '先设置岗位筛选、AI 模型和投递上限；勾选启用后保存配置。帮助模式可查看各项说明。'),
                V('p', null, 'AI 招呼支持两条或三条，发送与翻页使用已保存的间隔设置。可随时停止任务。'),
                V('p', null, '更新前先停止任务，重新加载扩展后刷新 BOSS 页面。'),
                H(OX, {to: BHProject.repository, target: '_blank'}, {
                  default: F(() => [U('打开我的项目仓库')]), _: 1,
                }),
              ])]),
              footer: F(() => [H(AX, {color: 'primary', onClick: acceptWelcome}, {
                default: F(() => [U('开始使用')]), _: 1,
              })]), _: 1,
            }),
          ]), _: 1,
        }),
      ]);
    };
  },
})
