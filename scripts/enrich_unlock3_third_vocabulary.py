#!/usr/bin/env python3
"""Add reviewed examples to Unlock 3 third-edition append candidates."""

import concurrent.futures
import json
import re
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/unlock-vocabulary/unlock3-third-edition"
REMOTE_BASE = "https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la"

# Manual entries cover new third-edition terms that do not occur in any live Unlock book.
# Sentences use the academic, contextual register and length expected at Unlock 3/B1.
MANUAL_EXAMPLES = {
    "take actions": ("Local authorities should take actions to protect endangered habitats.", "地方当局应采取行动保护濒危栖息地。"),
    "take steps": ("The city has taken steps to reduce air pollution.", "该市已采取措施减少空气污染。"),
    "mangrove forest": ("A healthy mangrove forest protects the coast from strong waves.", "健康的红树林能保护海岸免受强浪冲击。"),
    "coral reef": ("The coral reef provides food and shelter for many sea creatures.", "珊瑚礁为许多海洋生物提供食物和栖息地。"),
    "hydroelectric": ("The region produces hydroelectric power from mountain rivers.", "该地区利用山间河流生产水电。"),
    "world heritage site": ("The ancient city became a World Heritage Site in 1987.", "这座古城于1987年成为世界遗产。"),
    "the great reef": ("Pollution is damaging parts of the Great Reef.", "污染正在损害大堡礁的部分区域。"),
    "generalization": ("This generalization is based on evidence from only one community.", "这一概括仅基于一个社区的证据。"),
    "carbohydrates": ("Carbohydrates provide the body with energy for exercise.", "碳水化合物为身体提供运动所需的能量。"),
    "saturated fat": ("Eating too much saturated fat may increase the risk of heart disease.", "摄入过多饱和脂肪可能会增加心脏病风险。"),
    "cholesterol": ("Regular exercise can help lower cholesterol levels.", "经常锻炼有助于降低胆固醇水平。"),
    "spider": ("A spider produces silk to build its web.", "蜘蛛会吐丝结网。"),
    "cambodia": ("Many clothing companies have factories in Cambodia.", "许多服装公司在柬埔寨设有工厂。"),
    "bangladesh": ("The study examined working conditions in factories in Bangladesh.", "该研究考察了孟加拉国工厂的工作条件。"),
    "ferrari": ("A well-maintained Ferrari may increase in value over time.", "一辆保养良好的法拉利汽车可能会随着时间升值。"),
    "mercedes-benz": ("The collector bought a classic Mercedes-Benz at an auction.", "这位收藏家在拍卖会上买了一辆经典梅赛德斯奔驰汽车。"),
    "aston martin": ("The price of the rare Aston Martin rose sharply.", "这辆罕见的阿斯顿·马丁汽车价格急剧上涨。"),
    "domesticated": ("Domesticated animals often depend on people for food and shelter.", "家养动物常常依赖人类获取食物和住所。"),
    "civilization": ("Every civilization develops its own relationship with the natural world.", "每一种文明都会形成自己与自然界的关系。"),
    "abuse": ("The law protects animals from abuse and cruel treatment.", "该法律保护动物免受虐待和残忍对待。"),
    "involve": ("Protecting endangered species involves cooperation between several countries.", "保护濒危物种需要多个国家之间的合作。"),
    "summarize": ("Please summarize the main argument in two sentences.", "请用两句话概括主要论点。"),
    "majestic": ("The documentary shows majestic elephants crossing the grassland.", "这部纪录片展现了壮丽的大象穿过草原的画面。"),
    "welfare": ("The new rules are designed to improve animal welfare.", "这些新规定旨在改善动物福利。"),
    "critically": ("The species is now critically endangered because of habitat loss.", "由于栖息地丧失，该物种现已处于极度濒危状态。"),
    "poacher": ("A poacher was arrested for hunting elephants illegally.", "一名偷猎者因非法猎杀大象而被捕。"),
    "ivory": ("International trade in ivory is strictly controlled.", "象牙的国际贸易受到严格管控。"),
    "protect...from": ("Thick fur protects polar bears from the cold.", "厚厚的毛皮保护北极熊免受严寒。"),
    "be native to": ("This plant is native to the tropical forests of South America.", "这种植物原产于南美洲的热带森林。"),
    "neither...nor": ("Neither the road nor the bridge is safe for wildlife.", "这条公路和这座桥对野生动物来说都不安全。"),
    "limited": ("Fresh water is a limited resource in many regions.", "在许多地区，淡水是一种有限资源。"),
    "opponent": ("Opponents of the plan argue that it will cost too much.", "该计划的反对者认为它的成本会过高。"),
    "wind power": ("Wind power can provide clean electricity to coastal communities.", "风力可以为沿海社区提供清洁电力。"),
    "otherwise": ("We must reduce emissions; otherwise, global temperatures will continue to rise.", "我们必须减少排放，否则全球气温将继续上升。"),
    "constant": ("Constant traffic noise can affect the health of local residents.", "持续的交通噪声会影响当地居民的健康。"),
    "continuous": ("The machine requires a continuous supply of electricity.", "这台机器需要持续供电。"),
    "natural resource": ("Water is a natural resource that must be managed carefully.", "水是一种必须谨慎管理的自然资源。"),
    "plane": ("Taking a plane is fast, but it produces significant carbon emissions.", "乘飞机很快，但会产生大量碳排放。"),
    "congestion": ("A new bus lane has helped reduce congestion in the city centre.", "一条新的公交专用道已帮助减轻市中心的拥堵。"),
    "registration": ("Online registration for the bicycle-sharing scheme opens on Monday.", "共享单车计划的网上注册将于周一开放。"),
    "suspension": ("The bridge closure led to the suspension of several bus services.", "桥梁封闭导致多条公交线路暂停运营。"),
    "primary": ("The primary aim of the project is to make transport safer.", "该项目的主要目标是让交通更安全。"),
    "blocks": ("The station is three blocks from the university.", "车站距离大学有三个街区。"),
    "annoy": ("Drivers who block cycle lanes annoy local cyclists.", "堵住自行车道的司机会令当地骑行者感到烦恼。"),
    "improvement": ("The new timetable is a clear improvement on the old one.", "新时刻表比旧时刻表有了明显改进。"),
    "drone": ("A drone was used to inspect the damaged railway line.", "一架无人机被用来检查受损的铁路线。"),
    "avoid": ("Cyclists should avoid busy roads during rush hour.", "骑行者应避免在高峰时段走繁忙道路。"),
    "steer": ("The driver steered the bus safely around the obstacle.", "司机驾驶公交车安全绕过了障碍物。"),
    "pass": ("Only one vehicle can pass through the narrow tunnel at a time.", "这条狭窄的隧道每次只能通过一辆车。"),
    "drive-through": ("The restaurant opened a drive-through to serve customers more quickly.", "这家餐厅开设了免下车服务，以更快地服务顾客。"),
    "spill": ("Be careful not to spill your drink on the bus.", "小心别把饮料洒在公交车上。"),
    "cable car": ("The cable car carries visitors to the top of the mountain.", "缆车将游客送到山顶。"),
    "escalator": ("The escalator connects the underground station with the shopping centre.", "自动扶梯连接地铁站和购物中心。"),
    "on the outskirts": ("The new airport was built on the outskirts of the city.", "新机场建在城市郊区。"),
    "unexpected": ("An unexpected delay caused many passengers to miss their connections.", "一次意外延误导致许多乘客错过了转乘班次。"),
    "in some cases": ("In some cases, cycling is faster than travelling by car.", "在某些情况下，骑自行车比开车更快。"),
    "uphill": ("The final part of the cycle route goes uphill.", "这条骑行路线的最后一段是上坡路。"),
    "story": ("The library occupies the top story of the building.", "图书馆位于这栋建筑的顶层。"),
    "attract": ("Reliable public transport can attract more people to the city centre.", "可靠的公共交通可以吸引更多人前往市中心。"),
    "a variety of": ("The transport network offers a variety of services for commuters.", "该交通网络为通勤者提供多种服务。"),
    "fuel duty": ("The government raised fuel duty to discourage unnecessary driving.", "政府提高燃油税，以减少不必要的驾车出行。"),
    "operate": ("The metro system operates from five in the morning until midnight.", "地铁系统从早上五点运行到午夜。"),
    "lower": ("Cheaper fares could lower the number of cars on the road.", "更低的票价可以减少路上的汽车数量。"),
    "require": ("The proposal will require careful planning and public support.", "该提案将需要周密规划和公众支持。"),
    "frighten": ("Unfamiliar customs can frighten visitors who are unprepared.", "陌生的习俗可能会使没有准备的游客感到害怕。"),
    "interact": ("Students interact with people from different cultures during the exchange.", "交流期间，学生们与来自不同文化的人交往。"),
    "obligation": ("Guests have an obligation to respect local customs.", "客人有义务尊重当地习俗。"),
    "specialize": ("Some anthropologists specialize in the study of traditional festivals.", "一些人类学家专门研究传统节日。"),
    "thoughtful": ("It was thoughtful of our host to explain the local customs.", "主人向我们解释当地习俗，非常体贴。"),
    "be related to": ("Many traditional celebrations are related to the changing seasons.", "许多传统庆典与季节变化有关。"),
    "protection": ("The agreement provides protection for important cultural sites.", "该协议为重要文化遗址提供保护。"),
    "story telling": ("Story telling helps communities pass traditions to younger generations.", "讲故事有助于社区将传统传给年轻一代。"),
    "performing arts": ("Music and dance are important forms of the performing arts.", "音乐和舞蹈是表演艺术的重要形式。"),
    "the pyramids of giza": ("The Pyramids of Giza attract millions of visitors each year.", "吉萨金字塔每年吸引数百万名游客。"),
    "entry": ("The festival was added as a new entry on the heritage list.", "该节日作为新条目被列入遗产名录。"),
    "beauty contest": ("The traditional beauty contest is now part of the town's annual festival.", "这项传统选美比赛现已成为该镇年度节庆的一部分。"),
    "frequently": ("Cultural traditions frequently change when societies become more global.", "当社会变得更加全球化时，文化传统常常会发生变化。"),
    "brain": ("Regular exercise can improve both the body and the brain.", "经常锻炼可以同时改善身体和大脑状态。"),
    "neuron": ("Each neuron sends signals to other cells in the brain.", "每个神经元都会向大脑中的其他细胞发送信号。"),
    "lifting": ("Heavy lifting can cause injury if it is done incorrectly.", "如果方式不正确，举重物可能导致受伤。"),
    "tracker": ("A fitness tracker records how far you walk each day.", "健身追踪器会记录你每天步行的距离。"),
    "headache": ("Not drinking enough water can give you a headache.", "饮水不足可能会让你头痛。"),
    "nut": ("A handful of nuts can be a healthy snack.", "一小把坚果可以作为健康零食。"),
    "acid": ("Some fruits contain acids that can damage your teeth.", "一些水果含有可能损伤牙齿的酸性物质。"),
    "come down with": ("She came down with the flu after the long journey.", "长途旅行后，她患上了流感。"),
    "cut down on": ("Doctors advise people to cut down on sugar and salt.", "医生建议人们减少糖和盐的摄入。"),
    "emotional": ("Exercise can support both physical and emotional health.", "锻炼可以促进身体健康和情绪健康。"),
    "get over": ("It took him several weeks to get over the illness.", "他花了几周时间才从疾病中恢复。"),
    "intellectual": ("Reading provides intellectual exercise for the brain.", "阅读为大脑提供智力锻炼。"),
    "join in": ("Everyone was invited to join in the outdoor activities.", "每个人都受邀参加户外活动。"),
    "sign up for": ("More than fifty students signed up for the fitness course.", "五十多名学生报名参加了健身课程。"),
    "try out for": ("She decided to try out for the school basketball team.", "她决定参加校篮球队的选拔。"),
    "work out": ("The researchers are trying to work out why the treatment failed.", "研究人员正试图找出治疗失败的原因。"),
    "lose weight": ("A balanced diet can help people lose weight safely.", "均衡饮食可以帮助人们安全减重。"),
    "in addition": ("The centre offers exercise classes; in addition, it provides health advice.", "该中心提供锻炼课程；此外，它还提供健康建议。"),
    "strengthen muscles": ("Swimming is an effective way to strengthen muscles without harming the joints.", "游泳是一种在不伤害关节的情况下增强肌肉的有效方式。"),
    "gardening": ("Gardening is a gentle form of exercise for older adults.", "园艺活动是适合老年人的温和锻炼方式。"),
    "anti-smoking campaigns": ("Anti-smoking campaigns have reduced tobacco use among teenagers.", "禁烟运动已减少了青少年的烟草使用。"),
    "ban": ("The city introduced a ban on smoking in public parks.", "该市实施了公共公园禁烟令。"),
    "promotion": ("The programme focuses on the promotion of healthy eating.", "该项目重点推广健康饮食。"),
    "recognition": ("There is growing recognition of the importance of mental health.", "人们越来越认识到心理健康的重要性。"),
    "although": ("Although the treatment is simple, it can be very effective.", "尽管这种治疗方法很简单，但可能非常有效。"),
    "vacuum": ("Sound cannot travel through a complete vacuum.", "声音无法在完全真空中传播。"),
    "collaboration": ("The invention was the result of collaboration between scientists and engineers.", "这项发明是科学家和工程师合作的成果。"),
    "seed": ("The tiny hooks allow the seed to stick to animal fur.", "这些微小的钩子使种子能够粘在动物毛皮上。"),
    "hook": ("Each hook attaches firmly to the surface of the fabric.", "每个钩子都会牢牢地附着在织物表面。"),
    "initially": ("Initially, the material was designed for use in space.", "起初，这种材料是为太空使用而设计的。"),
    "mussel": ("A mussel can attach itself securely to a wet rock.", "贻贝能够牢固地附着在湿滑的岩石上。"),
    "adhesive": ("Researchers developed an adhesive based on the way mussels attach to rocks.", "研究人员根据贻贝附着在岩石上的方式开发了一种粘合剂。"),
    "web": ("The structure of a spider's web inspired the new design.", "蜘蛛网的结构为这项新设计带来了灵感。"),
    "deepfake": ("A deepfake can make a person appear to say something they never said.", "深度伪造可以让一个人看起来说了从未说过的话。"),
    "artificial intelligence": ("Artificial intelligence can identify patterns in large amounts of data.", "人工智能可以识别大量数据中的模式。"),
    "celebrity": ("The advertisement used a celebrity to attract younger customers.", "该广告利用一位名人吸引年轻顾客。"),
    "excitement": ("There was great excitement when the new technology was demonstrated.", "这项新技术演示时，人们非常兴奋。"),
    "film a scene": ("The crew returned to the city centre to film a scene.", "剧组回到市中心拍摄一个场景。"),
    "embarrassing": ("Sharing a false image online can create an embarrassing situation.", "在网上分享虚假图像可能造成令人尴尬的局面。"),
    "frightening": ("The speed at which false information spreads can be frightening.", "虚假信息的传播速度可能令人害怕。"),
    "responsibly": ("People should use artificial intelligence responsibly.", "人们应当负责任地使用人工智能。"),
    "will definitely": ("The new discovery will definitely influence future research.", "这项新发现肯定会影响未来的研究。"),
    "will probably": ("Robots will probably perform more routine tasks in the future.", "未来，机器人很可能会执行更多日常任务。"),
    "definitely won't": ("This small device definitely won't replace trained doctors.", "这个小设备肯定不会取代受过训练的医生。"),
    "probably won't": ("The technology probably won't become affordable for several years.", "这项技术在未来几年里可能还无法变得价格可承受。"),
    "could possibly": ("This material could possibly be used to make safer buildings.", "这种材料可能会被用于建造更安全的建筑。"),
    "unsafe": ("The researchers stopped the test because the equipment was unsafe.", "研究人员因设备不安全而停止了测试。"),
    "rethink": ("New evidence may force scientists to rethink their original theory.", "新证据可能迫使科学家重新思考原来的理论。"),
    "translate": ("This application can translate spoken language in real time.", "这款应用程序可以实时翻译口语。"),
    "thesis statement": ("A clear thesis statement tells the reader the main argument of an essay.", "清晰的论点陈述会告诉读者文章的主要论点。"),
    "background information": ("The introduction provides background information about the invention.", "引言提供了有关该发明的背景信息。"),
    "remind... of": ("This pattern reminds me of traditional African art.", "这种图案使我想起传统的非洲艺术。"),
    "copyright": ("The designer owns the copyright to the original image.", "设计师拥有该原创图像的版权。"),
    "collaborate": ("Local artists collaborated with students on the fashion project.", "当地艺术家与学生合作完成了这个时尚项目。"),
    "hesitate": ("Some consumers hesitate to buy clothes made under poor working conditions.", "一些消费者会犹豫是否购买在恶劣工作条件下制作的服装。"),
    "thrifting": ("Thrifting has become popular among young consumers who want to reduce waste.", "在希望减少浪费的年轻消费者中，购买二手物品已变得流行。"),
    "follower": ("The internet influencer has more than a million followers.", "这位网络红人拥有一百多万名粉丝。"),
    "ashamed": ("The company was ashamed of the poor conditions in its factory.", "该公司对其工厂的恶劣条件感到羞愧。"),
    "internet influencer": ("An internet influencer promoted the new clothing brand online.", "一位网络红人在网上推广了这个新服装品牌。"),
    "second-hand clothing": ("Buying second-hand clothing extends the life of useful products.", "购买二手服装可以延长有用商品的使用寿命。"),
    "popularity": ("The popularity of fast fashion has increased clothing waste.", "快时尚的流行增加了服装废弃物。"),
    "sustainability strategy": ("The brand's sustainability strategy includes using recycled materials.", "该品牌的可持续发展策略包括使用回收材料。"),
    "wardrobe": ("She built a smaller wardrobe of durable, high-quality clothes.", "她用耐用的高质量服装组成了一个更精简的衣橱。"),
    "paid by the piece": ("Factory workers who are paid by the piece may work very long hours.", "按件计酬的工厂工人可能会工作很长时间。"),
    "exception": ("Most products were made locally, with one important exception.", "大多数产品都在当地制造，但有一个重要的例外。"),
    "except for": ("Except for the buttons, the entire jacket is made from recycled material.", "除了纽扣之外，整件夹克都由回收材料制成。"),
    "other than": ("The company has no overseas factories other than the one in Vietnam.", "除了越南的那家工厂外，该公司没有其他海外工厂。"),
    "apart from": ("Apart from reducing waste, repairing clothes can also save money.", "除了减少浪费，修补衣服还能省钱。"),
    "preference": ("Many consumers show a preference for products made ethically.", "许多消费者更偏爱以符合道德的方式生产的商品。"),
    "rather than": ("The designer chose natural fibres rather than plastic materials.", "设计师选择了天然纤维而不是塑料材料。"),
    "instead of": ("Try repairing old clothes instead of throwing them away.", "尝试修补旧衣服，而不是把它们扔掉。"),
    "satisfaction": ("People often gain more satisfaction from experiences than from possessions.", "与物质拥有相比，人们往往从经历中获得更多满足感。"),
    "psychologist": ("The psychologist studied how spending habits affect happiness.", "这位心理学家研究了消费习惯如何影响幸福感。"),
    "dopamine": ("The brain releases dopamine when people expect a reward.", "当人们期待奖励时，大脑会释放多巴胺。"),
    "admit": ("He admitted that he often bought things he did not need.", "他承认自己经常购买不需要的东西。"),
    "complicate": ("Unexpected fees can complicate a family's financial plans.", "意外费用可能会使一个家庭的财务计划变得复杂。"),
    "finance": ("She studied finance to understand how businesses manage money.", "她学习金融，以了解企业如何管理资金。"),
    "millionaire": ("The millionaire continued to live a simple lifestyle.", "这位百万富翁仍然过着简朴的生活。"),
    "national": ("The survey compared national patterns of saving and spending.", "该调查比较了全国的储蓄和消费模式。"),
    "afford": ("Many young families cannot afford to buy a home.", "许多年轻家庭买不起房子。"),
    "decision": ("A major financial decision should be based on reliable evidence.", "重大财务决定应以可靠证据为依据。"),
    "confident": ("She felt confident about managing her monthly budget.", "她对管理自己的每月预算很有信心。"),
    "sense": ("Keeping a record of your spending gives you a sense of control.", "记录支出会让你有一种掌控感。"),
    "simply": ("Being wealthy does not simply mean having a high income.", "富有并不仅仅意味着拥有高收入。"),
    "classic cars": ("Classic cars can increase in value if they are carefully maintained.", "如果细心保养，古董车可能会升值。"),
    "inequality": ("Income inequality can limit access to education and healthcare.", "收入不平等会限制人们获得教育和医疗保健的机会。"),
    "buying power": ("Rising prices have reduced the buying power of many households.", "物价上涨降低了许多家庭的购买力。"),
    "shortage": ("A shortage of skilled workers can slow economic growth.", "熟练工人短缺可能会减缓经济增长。"),
    "employment": ("Investment in new industries can create employment in rural areas.", "对新产业的投资可以在农村地区创造就业机会。"),
    "unequal": ("Access to financial services remains unequal across the country.", "全国各地获得金融服务的机会仍然不平等。"),
    "streaming": ("Streaming has changed the way people pay for music and films.", "流媒体改变了人们为音乐和电影付费的方式。"),
    "rise sharply": ("House prices began to rise sharply after interest rates fell.", "利率下降后，房价开始急剧上涨。"),
    "decrease sharply": ("Demand for the product decreased sharply during the recession.", "经济衰退期间，对该产品的需求急剧下降。"),
    "a sharp rise": ("The graph shows a sharp rise in household spending.", "该图表显示家庭支出急剧上升。"),
    "a sharp decrease": ("There was a sharp decrease in sales at the end of the year.", "年底销售额急剧下降。"),
    "fluctuate considerably": ("Energy prices can fluctuate considerably from one month to the next.", "能源价格每月可能会大幅波动。"),
    "fall dramatically": ("The value of the shares fell dramatically after the announcement.", "公告发布后，股价大幅下跌。"),
    "increase slightly": ("Average incomes increased slightly in the final quarter.", "平均收入在最后一个季度略有增加。"),
}

REVIEWED_OVERRIDES = {
    "ship": ("The company ships clothing from its overseas factories to stores around the world.", "该公司将海外工厂生产的服装运送到世界各地的商店。"),
    "earn": ("You can earn a good income while helping other people.", "你可以在帮助他人的同时获得不错的收入。"),
    "lifestyle": ("A busy lifestyle can make it difficult to manage money carefully.", "忙碌的生活方式可能会让谨慎理财变得困难。"),
    "professional": ("Professional photographers were hired to record the parade.", "人们聘请了专业摄影师来记录游行。"),
    "supply": ("The space station needs a regular supply of water and oxygen.", "空间站需要稳定供应水和氧气。"),
}


def norm(value):
    return re.sub(r"\s+", " ", str(value or "").lower().strip())


def fetch(path):
    request = urllib.request.Request(f"{REMOTE_BASE}/{path}", headers={"User-Agent": "Unlock3ExampleBuilder/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read())


def load_live_examples():
    paths = [
        f"dictionary_books/unlock-v2/level-{level}/unit-{unit}/{section}.json"
        for level in range(1, 5) for unit in range(1, 9) for section in ("ls", "rw")
    ]
    index = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        for rows in executor.map(fetch, paths):
            for row in rows:
                if row.get("example") and row.get("exampleMeaning"):
                    index.setdefault(norm(row.get("word")), (row["example"], row["exampleMeaning"]))
    return index


def main():
    live_examples = load_live_examples()
    new_keys = {row["candidateKey"] for row in json.loads((SOURCE / "new-candidate.json").read_text(encoding="utf-8"))}
    report = {"books": [], "newTotal": 0, "reusedLive": 0, "manualReviewed": 0, "missing": []}
    new_rows = []
    for unit in range(1, 9):
        for section in ("ls", "rw"):
            path = SOURCE / f"unit-{unit}-{section}.json"
            rows = json.loads(path.read_text(encoding="utf-8"))
            book_new = 0
            for row in rows:
                key = f"u{unit}-{section}-{norm(row['word'])}"
                if key not in new_keys:
                    old_example = live_examples.get(norm(row["word"]))
                    if old_example:
                        row["example"], row["exampleMeaning"] = old_example
                    continue
                book_new += 1
                example = REVIEWED_OVERRIDES.get(norm(row["word"])) or live_examples.get(norm(row["word"]))
                source = "manual-reviewed" if norm(row["word"]) in REVIEWED_OVERRIDES else "live-unlock-reuse"
                if not example:
                    example = MANUAL_EXAMPLES.get(norm(row["word"]))
                    source = "manual-reviewed"
                if not example:
                    report["missing"].append({"unit": unit, "section": section.upper(), "word": row["word"]})
                    continue
                row["example"], row["exampleMeaning"] = example
                row["exampleSource"] = source
                report["reusedLive" if source == "live-unlock-reuse" else "manualReviewed"] += 1
                row["candidateKey"] = key
                new_rows.append(row)
            path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            report["books"].append({"unit": unit, "section": section.upper(), "new": book_new})
            report["newTotal"] += book_new

    (SOURCE / "new-candidate.json").write_text(json.dumps(new_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report["ready"] = report["newTotal"] == len(new_rows) and not report["missing"]
    (SOURCE / "examples-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["ready"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
