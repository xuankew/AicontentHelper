import type { ComponentType } from "react";
import type { MokaUpstreamSplitId } from "./mokaUpstreamSplitIds";

import { ArtisticCover, ArtisticContent, ArtisticEnd } from "../../moka-upstream/split/ArtisticStyle.jsx";
import { BusinessCover, BusinessContent, BusinessEnd } from "../../moka-upstream/split/BusinessStyle.jsx";
import { CleanCover, CleanContent, CleanEnd } from "../../moka-upstream/split/CleanStyle.jsx";
import { CreamyCover, CreamyContent, CreamyEnd } from "../../moka-upstream/split/CreamyStyle.jsx";
import { DarkCover, DarkContent, DarkEnd } from "../../moka-upstream/split/DarkStyle.jsx";
import {
	EditorialCover,
	EditorialContent,
	EditorialEnd,
} from "../../moka-upstream/split/EditorialStyle.jsx";
import { EduCover, EduContent, EduEnd } from "../../moka-upstream/split/EduStyle.jsx";
import {
	FashionCover,
	FashionContent,
	FashionEnd,
} from "../../moka-upstream/split/FashionStyle.jsx";
import {
	FinanceCover,
	FinanceContent,
	FinanceEnd,
} from "../../moka-upstream/split/FinanceStyle.jsx";
import { FoodCover, FoodContent, FoodEnd } from "../../moka-upstream/split/FoodStyle.jsx";
import {
	ForestCover,
	ForestContent,
	ForestEnd,
} from "../../moka-upstream/split/ForestStyle.jsx";
import {
	GradientCover,
	GradientContent,
	GradientEnd,
} from "../../moka-upstream/split/GradientStyle.jsx";
import { InsCover, InsContent, InsEnd } from "../../moka-upstream/split/InsStyle.jsx";
import {
	JapaneseCover,
	JapaneseContent,
	JapaneseEnd,
} from "../../moka-upstream/split/JapaneseStyle.jsx";
import {
	KoreanCover,
	KoreanContent,
	KoreanEnd,
} from "../../moka-upstream/split/KoreanStyle.jsx";
import { LawCover, LawContent, LawEnd } from "../../moka-upstream/split/LawStyle.jsx";
import {
	LuxuryCover,
	LuxuryContent,
	LuxuryEnd,
} from "../../moka-upstream/split/LuxuryStyle.jsx";
import {
	MedicalCover,
	MedicalContent,
	MedicalEnd,
} from "../../moka-upstream/split/MedicalStyle.jsx";
import { MomCover, MomContent, MomEnd } from "../../moka-upstream/split/MomStyle.jsx";
import {
	PaperCover,
	PaperContent,
	PaperEnd,
} from "../../moka-upstream/split/PaperStyle.jsx";
import { PopCover, PopContent, PopEnd } from "../../moka-upstream/split/PopStyle.jsx";
import { PureCover, PureContent, PureEnd } from "../../moka-upstream/split/PureStyle.jsx";
import { RetroCover, RetroContent, RetroEnd } from "../../moka-upstream/split/RetroStyle.jsx";
import { TechCover, TechContent, TechEnd } from "../../moka-upstream/split/TechStyle.jsx";
import {
	TravelCover,
	TravelContent,
	TravelEnd,
} from "../../moka-upstream/split/TravelStyle.jsx";
import { VividCover, VividContent, VividEnd } from "../../moka-upstream/split/VividStyle.jsx";

// upstream split components props differ slightly; eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySplit = ComponentType<any>;

export type SplitTriple = {
	Cover: AnySplit;
	Content: AnySplit;
	End: AnySplit;
};

export const UPSTREAM_SPLIT_REGISTRY: Record<MokaUpstreamSplitId, SplitTriple> =
	{
		vivid: { Cover: VividCover, Content: VividContent, End: VividEnd },
		clean: { Cover: CleanCover, Content: CleanContent, End: CleanEnd },
		dark: { Cover: DarkCover, Content: DarkContent, End: DarkEnd },
		paper: { Cover: PaperCover, Content: PaperContent, End: PaperEnd },
		editorial: {
			Cover: EditorialCover,
			Content: EditorialContent,
			End: EditorialEnd,
		},
		gradient: {
			Cover: GradientCover,
			Content: GradientContent,
			End: GradientEnd,
		},
		creamy: { Cover: CreamyCover, Content: CreamyContent, End: CreamyEnd },
		retro: { Cover: RetroCover, Content: RetroContent, End: RetroEnd },
		forest: { Cover: ForestCover, Content: ForestContent, End: ForestEnd },
		ins: { Cover: InsCover, Content: InsContent, End: InsEnd },
		japanese: {
			Cover: JapaneseCover,
			Content: JapaneseContent,
			End: JapaneseEnd,
		},
		korean: { Cover: KoreanCover, Content: KoreanContent, End: KoreanEnd },
		pure: { Cover: PureCover, Content: PureContent, End: PureEnd },
		pop: { Cover: PopCover, Content: PopContent, End: PopEnd },
		artistic: {
			Cover: ArtisticCover,
			Content: ArtisticContent,
			End: ArtisticEnd,
		},
		luxury: { Cover: LuxuryCover, Content: LuxuryContent, End: LuxuryEnd },
		business: {
			Cover: BusinessCover,
			Content: BusinessContent,
			End: BusinessEnd,
		},
		tech: { Cover: TechCover, Content: TechContent, End: TechEnd },
		edu: { Cover: EduCover, Content: EduContent, End: EduEnd },
		medical: {
			Cover: MedicalCover,
			Content: MedicalContent,
			End: MedicalEnd,
		},
		finance: {
			Cover: FinanceCover,
			Content: FinanceContent,
			End: FinanceEnd,
		},
		law: { Cover: LawCover, Content: LawContent, End: LawEnd },
		food: { Cover: FoodCover, Content: FoodContent, End: FoodEnd },
		travel: {
			Cover: TravelCover,
			Content: TravelContent,
			End: TravelEnd,
		},
		fashion: {
			Cover: FashionCover,
			Content: FashionContent,
			End: FashionEnd,
		},
		mom: { Cover: MomCover, Content: MomContent, End: MomEnd },
	};
