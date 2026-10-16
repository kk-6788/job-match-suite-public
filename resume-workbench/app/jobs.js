window.JOB_TEMPLATES = {
  'wenyuan': {
    label:'文员 / 行政助理', job:'文员',
    skills:[
      {name:'Word 排版',level:4},{name:'Excel 表格统计',level:4},{name:'PPT 制作',level:3},
      {name:'公众号运营',level:3},{name:'会议记录',level:4},{name:'档案管理',level:4},
      {name:'沟通协调',level:4},{name:'细心有条理',level:4}
    ],
    keywords:['文档','表格','会议','档案','接待','通知','纪要','台账','办公','Word','Excel','PPT','Office','整理','归档','登记','录入','协调','细致'],
    hints:['文员岗：技能标签建议 6-10 个，突出 Word/Excel 熟练度','经历带数字：归档 200+ 份、月均处理 20+ 项、查找效率提升 50%','一页撑满即可，别写第二页']
  },
  'pm': {
    label:'产品经理实习生', job:'产品经理实习生',
    skills:[
      {name:'PRD/需求文档',level:4},{name:'原型图（Figma/墨刀/Axure）',level:3},
      {name:'Excel 数据分析',level:3},{name:'Python/MySQL',level:2},
      {name:'CET-6',level:4},{name:'AI 工具实践',level:3}
    ],
    keywords:['需求','PRD','用户','产品','方案','原型','数据','分析','调研','文档','竞品','流程','交互','功能','迭代','上线','项目','协作','A/B'],
    hints:['产品岗：经历按「需求分析→方案输出→协同推进」三段写','有项目一定要写，用 STAR：背景→你做的事→结果（带数字）','技能标签 6-10 个即可，CET-6 写分数（如 576）更具体']
  },
  'nurse': {
    label:'临床护士', job:'临床护士',
    skills:[
      {name:'静脉输液',level:4},{name:'肌内/皮下注射',level:4},{name:'吸痰',level:3},
      {name:'无菌技术',level:4},{name:'换药',level:3},{name:'压疮护理',level:3},
      {name:'心电监护',level:3},{name:'CPR',level:3},{name:'艾灸',level:3},
      {name:'拔罐',level:3},{name:'耳穴埋豆',level:2},{name:'中药烫熨',level:2},
      {name:'手术配合',level:3},{name:'护理文书',level:3},{name:'WPS/Office',level:3}
    ],
    keywords:['护理','输液','注射','无菌','患者','病房','交接班','三查七对','文书','监护','健康宣教','消毒','急救','CPR','巡视','记录','沟通','责任'],
    hints:['护理岗：护士执业资格证写全称，放证书栏（资格证用白字实值）','技能标签 15 个封顶，突出临床操作；WPS/Office 保留证明文书能力','描述体现责任心：交接班、三查七对、护理文书零差错']
  },
  'medicine': {
    label:'医药产品销售', job:'医药产品销售',
    skills:[
      {name:'药品分类与机制',level:3},{name:'适应症讲解',level:3},{name:'健康宣教',level:3},
      {name:'临床用药场景',level:3},{name:'医患沟通',level:4},{name:'信息整理',level:3},
      {name:'活动统筹',level:3},{name:'WPS/Office',level:3}
    ],
    keywords:['药品','客户','沟通','销售','推广','宣教','适应症','用药','区域','拜访','活动','数据','整理','汇报','跟进','医院','药店','方案'],
    hints:['医药销售岗：突出「客户沟通 + 区域跟进 + 活动执行」','有销售/推广经历带数字：拜访 X 家、覆盖 X 名客户、达成率 X%','技能标签 8-10 个，WPS/Office 保留']
  },
  'xmt': {
    label:'新媒体运营', job:'新媒体运营',
    skills:[
      {name:'内容策划',level:4},{name:'公众号/小红书运营',level:4},{name:'短视频脚本',level:3},
      {name:'热点追踪',level:3},{name:'数据复盘',level:3},{name:'排版工具（135/秀米）',level:3},
      {name:'PS/Canva 基础',level:3},{name:'粉丝互动',level:3}
    ],
    keywords:['内容','运营','用户','粉丝','流量','选题','排版','数据','增长','互动','爆款','文案','账号','转化','平台','活动','涨粉','复盘'],
    hints:['新媒体岗：经历按「选题→制作→数据→复盘」闭环写','有账号案例直接写涨粉/阅读量/互动率数字','技能标签 6-10 个']
  },
  'ds': {
    label:'电商运营', job:'电商运营',
    skills:[
      {name:'店铺运营',level:4},{name:'商品上下架',level:3},{name:'活动策划',level:3},
      {name:'数据复盘',level:4},{name:'直通车/推广',level:2},{name:'客服话术',level:3},
      {name:'Excel 分析',level:3},{name:'选品',level:3}
    ],
    keywords:['店铺','商品','销量','转化','活动','推广','数据','运营','客服','订单','流量','复盘','选品','详情页','售后','平台','爆款','库存'],
    hints:['电商岗：重点写「数据结果」——GMV、转化率、客单价、退款率','有直通车/推广经历写 ROI','技能标签 6-10 个']
  },
  'sc': {
    label:'市场营销', job:'市场营销',
    skills:[
      {name:'市场调研',level:4},{name:'活动策划',level:4},{name:'方案撰写',level:4},
      {name:'品牌推广',level:3},{name:'渠道拓展',level:3},{name:'数据分析',level:3},
      {name:'PPT 提案',level:4},{name:'落地执行',level:4}
    ],
    keywords:['市场','营销','品牌','活动','方案','渠道','推广','客户','调研','数据','落地','执行','预算','转化','投放','效果','复盘','提案'],
    hints:['营销岗：活动经历写「目标→方案→执行→结果（参与人数/转化）」','有预算管理写预算规模','技能标签 6-10 个']
  },
  'hr': {
    label:'人力资源', job:'人力资源',
    skills:[
      {name:'招聘',level:4},{name:'简历筛选',level:4},{name:'面试安排',level:3},
      {name:'入职办理',level:3},{name:'员工关系',level:3},{name:'考勤管理',level:3},
      {name:'社保公积金',level:2},{name:'Excel',level:4}
    ],
    keywords:['招聘','面试','入职','员工','简历','考勤','社保','培训','绩效','沟通','档案','制度','离职','流程','合同','数据','组织','协调'],
    hints:['HR 岗：突出「招聘完成率/入职人数/流程效率」数字','有培训/团建经历带上','技能标签 6-10 个']
  },
  'cw': {
    label:'会计/出纳', job:'会计/出纳',
    skills:[
      {name:'凭证处理',level:4},{name:'账务登记',level:4},{name:'发票管理',level:3},
      {name:'报销审核',level:3},{name:'银行对账',level:3},{name:'Excel 函数',level:4},
      {name:'财务软件（用友/金蝶）',level:3},{name:'报表编制',level:3}
    ],
    keywords:['凭证','账务','发票','报销','对账','报表','核算','税务','银行','会计','出纳','总账','明细','审计','合规','数据','准确','凭证'],
    hints:['财务岗：突出「准确率、零差错、处理量」——凭证 1000+ 张零差错','有财务软件经历写软件名（用友/金蝶）','技能标签 6-10 个']
  },
  'kf': {
    label:'客服专员', job:'客服专员',
    skills:[
      {name:'客户沟通',level:4},{name:'问题处理',level:4},{name:'售后跟进',level:3},
      {name:'话术整理',level:3},{name:'工单系统',level:3},{name:'情绪管理',level:4},
      {name:'数据统计',level:3},{name:'打字速度',level:4}
    ],
    keywords:['客户','沟通','售后','问题','处理','工单','满意度','投诉','反馈','跟进','服务','话术','数据','记录','时效','解决','耐心','响应'],
    hints:['客服岗：突出「响应时效、解决率、客户满意度」数字','有投诉处理案例写上','技能标签 6-10 个']
  },
  'xs': {
    label:'销售代表', job:'销售代表',
    skills:[
      {name:'客户开发',level:4},{name:'电话/面销',level:4},{name:'需求挖掘',level:4},
      {name:'产品讲解',level:4},{name:'报价谈判',level:3},{name:'订单跟进',level:3},
      {name:'CRM 系统',level:3},{name:'业绩复盘',level:3}
    ],
    keywords:['客户','销售','业绩','订单','拜访','成交','签约','需求','谈判','跟进','回款','目标','转化','渠道','产品','市场','提成','复盘'],
    hints:['销售岗：业绩数字第一位——成交额/单量/达成率/排名','有拓客经历写新开客户数','技能标签 6-10 个']
  },
  'dev': {
    label:'前端/后端开发', job:'前端/后端开发',
    skills:[
      {name:'HTML/CSS',level:4},{name:'JavaScript',level:4},{name:'Vue/React',level:3},
      {name:'Python/Java',level:3},{name:'MySQL',level:3},{name:'Git',level:3},
      {name:'接口联调',level:3},{name:'代码规范',level:3}
    ],
    keywords:['开发','前端','后端','接口','数据库','代码','项目','部署','测试','需求','迭代','性能','优化','架构','Git','上线','功能','联调'],
    hints:['开发岗：项目经历写「技术栈 + 你负责的模块 + 效果」','有 GitHub/作品集附链接','技能标签 8-12 个']
  },
  'dsj': {
    label:'数据分析师', job:'数据分析师',
    skills:[
      {name:'Excel 透视表',level:4},{name:'SQL',level:4},{name:'Python 分析',level:3},
      {name:'可视化（Tableau/BI）',level:3},{name:'A/B 测试',level:2},{name:'报表搭建',level:4},
      {name:'数据清洗',level:3},{name:'业务洞察',level:3}
    ],
    keywords:['数据','分析','报表','指标','可视化','清洗','建模','趋势','洞察','SQL','Python','效果','归因','埋点','复盘','决策','增长','实验'],
    hints:['数据分析岗：写「分析场景→方法→结论→落地效果」','指标口径写清楚（DAU/转化率/留存）','技能标签 6-10 个']
  },
  'ui': {
    label:'平面/UI 设计', job:'平面/UI 设计',
    skills:[
      {name:'Photoshop',level:4},{name:'Illustrator',level:3},{name:'Figma',level:4},
      {name:'海报/Banner',level:4},{name:'视觉排版',level:4},{name:'色彩构成',level:3},
      {name:'切图标注',level:3},{name:'设计规范',level:3}
    ],
    keywords:['设计','视觉','海报','Banner','排版','配色','图标','界面','规范','素材','落地','改稿','创意','风格','品牌','交互','图层','交付'],
    hints:['设计岗：作品集链接最重要，务必放上','技能标签 6-10 个，写工具名+熟练度']
  },
  'vj': {
    label:'视频剪辑/后期', job:'视频剪辑/后期',
    skills:[
      {name:'剪映',level:4},{name:'Premiere',level:4},{name:'After Effects',level:3},
      {name:'镜头语言',level:3},{name:'节奏把控',level:4},{name:'字幕/音效',level:3},
      {name:'封面设计',level:3},{name:'成片交付',level:3}
    ],
    keywords:['剪辑','视频','镜头','节奏','音效','字幕','调色','脚本','成片','发布','播放','数据','平台','转场','特效','交付','创意','复盘'],
    hints:['剪辑岗：作品集/账号数据（播放/完播率）是硬通货','技能标签 6-10 个']
  },
  'js': {
    label:'教师/助教', job:'教师/助教',
    skills:[
      {name:'课程设计',level:4},{name:'备课授课',level:4},{name:'课堂管理',level:3},
      {name:'作业批改',level:3},{name:'家校沟通',level:3},{name:'教研活动',level:3},
      {name:'PPT 课件',level:4},{name:'学生辅导',level:3}
    ],
    keywords:['教学','课程','学生','课堂','备课','教案','作业','辅导','家长','教研','课件','班级','成绩','反馈','活动','组织','沟通','认真'],
    hints:['教师岗：写「带班人数/学生成绩提升/家长满意度」数字','有教资证写证书栏','技能标签 6-10 个']
  },
  'general': {
    label:'通用（清空岗位预设）', job:'',
    skills:[],
    keywords:['沟通','协作','团队','数据','分析','方案','执行','客户','时间','管理','效率','独立','抗压','细节','学习','Excel','Office','PPT','Word'],
    hints:['通用模板：技能、关键词自由填写','想按岗位快速起步，点顶栏「岗位模板」选一个岗位']
  }
};
