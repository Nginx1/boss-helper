I({
  __name: 'PersonalVersion',
  emits: ['close'],
  setup(props, {emit}) {
    return () => {
      R();
      return B(hQ, {title: BHProject.name}, {
        body: F(() => [V('div', {class: 'space-y-3 select-text'}, [
          V('div', null, '当前版本：v' + BHProject.version),
          V('div', null, '维护者：' + BHProject.maintainer),
          V('div', null, '发布日期：' + BHProject.releaseDate),
          V('div', null, BHProject.releaseNotes),
          H(OX, {to: BHProject.repository, target: '_blank'}, {
            default: F(() => [U('项目仓库')]), _: 1,
          }),
          V('div', {class: 'text-sm text-muted'}, '版本信息随扩展打包，不读取外部公告或商店版本。'),
        ])]),
        footer: F(() => [H(AX, {color: 'primary', onClick: () => emit('close', false)}, {
          default: F(() => [U('关闭')]), _: 1,
        })]),
        _: 1,
      });
    };
  },
})
