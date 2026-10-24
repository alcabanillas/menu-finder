import { SAMPLE_WEEK } from '@/app/_welcome/sample-data';
import { SampleRecipe, SampleSearch, SampleShopping } from '@/app/_welcome/sample-pieces';
import { WelcomeScreen } from '@/features/welcome/components/welcome-screen';

/** The visitor's home: the informative screen with its sample slots (UI-home-sin-login). */
export function WelcomeContent() {
  return (
    <WelcomeScreen
      search={<SampleSearch />}
      week={SAMPLE_WEEK}
      recipe={<SampleRecipe />}
      shopping={<SampleShopping />}
    />
  );
}
