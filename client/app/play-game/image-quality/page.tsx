"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Check, HelpCircle, X, Home, RotateCcw } from "lucide-react";
import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { useUser } from "@/providers/user-provider";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getGameConfig } from "../game-config";
import { useGameRewards } from "@/lib/hooks/use-game-rewards";

// Mock data for images
const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop',
  'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=300&h=200&fit=crop',
  'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=300&h=200&fit=crop',
  'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop'
];

export default function ImageQualityGamePage() {
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const router = useRouter();
  const { isAuthenticated } = useUser();

  // Get game configuration
  const gameConfig = getGameConfig('image-quality');
  
  const totalRounds = gameConfig?.stats.rounds || 3;

  // Use game rewards hook
  const { rewardsAwarded, awardRewards, resetRewards } = useGameRewards(
    gameConfig?.id || 'image-quality',
    {
      points: gameConfig?.rewards.points || 50,
      skill: gameConfig?.rewards.skill || 'science',
      skillValue: gameConfig?.rewards.skillValue || 5
    }
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Award rewards when game is completed
  useEffect(() => {
    if (isComplete && !rewardsAwarded) {
      awardRewards();
    }
  }, [isComplete, rewardsAwarded, awardRewards]);

  const handleImageSelect = (imageIndex: number) => {
    if (selectedImage !== null) return;
    
    setSelectedImage(imageIndex);
    setShowFeedback(true);
    
    // Simulate scoring (in real app, this would be based on actual quality metrics)
    const points = Math.floor(Math.random() * 20) + 10;
    setScore(score + points);
    
    setTimeout(() => {
      if (currentRound < totalRounds - 1) {
        setCurrentRound(currentRound + 1);
        setSelectedImage(null);
        setShowFeedback(false);
      } else {
        setIsComplete(true);
      }
    }, 2000);
  };

  const handlePlayAgain = () => {
    setCurrentRound(0);
    setScore(0);
    setIsComplete(false);
    setSelectedImage(null);
    setShowFeedback(false);
    resetRewards();
  };

  if (!gameConfig) {
    return <div>Game configuration not found</div>;
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <main className="h-[100dvh] w-full relative overflow-hidden pb-16">
      {/* Flickering Grid Background */}
      <FlickeringGrid
        className="absolute inset-0 -z-5 h-full w-full [mask-image:radial-gradient(1200px_circle_at_center,transparent,white)]"
        squareSize={4}
        gridGap={6}
        color="#6B7280"
        maxOpacity={0.5}
        flickerChance={0.1}
      />

      {/* Top Header Bar */}
      <header className="relative z-10 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 border-1 border-blue-800 shadow-[1px_1px_0_#1e3a8a]">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/play-game')}
            className="font-silkscreen text-xs font-bold text-white uppercase bg-blue-700 border-2 border-blue-900 shadow-[2px_2px_0_#1e3a8a] px-3 py-1 hover:bg-blue-600 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_#1e3a8a] transition-all flex items-center gap-2"
          >
            <ArrowLeft className="h-3 w-3" />
            BACK
          </button>
          
          <div className="font-silkscreen text-sm font-bold text-white uppercase tracking-wider drop-shadow-lg">
            {gameConfig.title.toUpperCase()}
          </div>
          
          <button
            onClick={() => setShowHelp(true)}
            className="font-silkscreen text-xs font-bold text-white uppercase bg-blue-700 border-2 border-blue-900 shadow-[2px_2px_0_#1e3a8a] px-3 py-1 hover:bg-blue-600 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_#1e3a8a] transition-all flex items-center gap-2"
          >
            <HelpCircle className="h-3 w-3" />
            HELP
          </button>
        </div>
      </header>

      {/* Help Dialog */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-gray-800 shadow-[8px_8px_0_#374151] p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="font-silkscreen text-lg font-bold text-gray-800 uppercase">
                HOW TO PLAY
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 border-2 border-gray-600 shadow-[2px_2px_0_#374151] bg-gray-100 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="font-silkscreen text-xs text-gray-600 uppercase space-y-2">
                {gameConfig.helpInstructions.map((instruction, index) => (
                  <p key={index}>{instruction}</p>
                ))}
              </div>
              
              <div className="bg-blue-100 border-2 border-blue-600 shadow-[2px_2px_0_#1e3a8a] p-3">
                <div className="font-silkscreen text-xs font-bold text-blue-800 uppercase">
                  REWARDS: {gameConfig.rewards.display}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 h-full overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {!isComplete && (
            /* Stats Cards Row */
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-100 border-4 border-blue-600 shadow-[4px_4px_0_#1e3a8a] p-2 text-center flex flex-col items-center justify-center">
                <div className="font-silkscreen text-lg font-bold text-blue-800 uppercase">
                  {currentRound + 1}/{totalRounds}
                </div>
                <div className="font-silkscreen text-xs font-bold text-blue-700 uppercase">
                  ROUND
                </div>
              </div>
              
              <div className="bg-green-100 border-4 border-green-600 shadow-[4px_4px_0_#14532d] p-2 text-center flex flex-col items-center justify-center">
                <div className="font-silkscreen text-lg font-bold text-green-800 uppercase">
                  {score}
                </div>
                <div className="font-silkscreen text-xs font-bold text-green-700 uppercase">
                  SCORE
                </div>
              </div>
              
              <div className="bg-purple-100 border-4 border-purple-600 shadow-[4px_4px_0_#581c87] p-2 text-center flex flex-col items-center justify-center">
                <div className="font-silkscreen text-lg font-bold text-purple-800 uppercase">
                  {gameConfig.timeEstimate}
                </div>
                <div className="font-silkscreen text-xs font-bold text-purple-700 uppercase">
                  TIME
                </div>
              </div>
            </div>
          )}

          {isComplete ? (
            /* Completion Screen */
            <div className="bg-white border-4 border-gray-800 shadow-[8px_8px_0_#374151] p-8 text-center">
              <div className="p-4 border-2 border-gray-600 shadow-[2px_2px_0_#374151] bg-yellow-100 border-yellow-600 text-yellow-800 inline-block mb-6">
                <Trophy className="h-12 w-12" />
              </div>
              
              <div className="font-silkscreen text-xl font-bold text-gray-800 uppercase mb-3">
                GAME COMPLETE!
              </div>
              <div className="font-silkscreen text-sm text-gray-600 uppercase mb-6">
                GREAT JOB RATING IMAGES!
              </div>
              
              <div className="space-y-4">
                {/* Navigation Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => router.push('/')}
                    className="font-silkscreen text-xs font-bold text-white uppercase bg-green-600 border-2 border-green-800 shadow-[2px_2px_0_#14532d] px-4 py-2 hover:bg-green-500 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_#14532d] transition-all flex items-center justify-center gap-2"
                  >
                    <Home className="h-3 w-3" />
                    HOME
                  </button>
                  
                  <button
                    onClick={() => router.push('/play-game')}
                    className="font-silkscreen text-xs font-bold text-white uppercase bg-blue-600 border-2 border-blue-800 shadow-[2px_2px_0_#1e3a8a] px-4 py-2 hover:bg-blue-500 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_#1e3a8a] transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="h-3 w-3" />
                    NEW GAME
                  </button>
                  
                  <button
                    onClick={handlePlayAgain}
                    className="font-silkscreen text-xs font-bold text-white uppercase bg-blue-600 border-2 border-blue-800 shadow-[2px_2px_0_#1e3a8a] px-4 py-2 hover:bg-blue-500 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_#1e3a8a] transition-all flex items-center justify-center gap-2"
                  >
                    <Trophy className="h-3 w-3" />
                    PLAY AGAIN
                  </button>
                </div>
                
                <div className="font-silkscreen text-xs text-green-700 uppercase font-bold">
                  {rewardsAwarded ? "✓ " : ""}REWARDS: {gameConfig.rewards.display}
                </div>
              </div>
            </div>
          ) : (
            /* Game Interface */
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-white border-4 border-gray-800 shadow-[8px_8px_0_#374151] p-4 text-center">
                <div className="font-silkscreen text-sm font-bold text-gray-800 uppercase">
                  CHOOSE THE HIGHEST QUALITY IMAGE
                </div>
              </div>

              {/* Image Grid */}
              <div className="bg-white border-4 border-gray-800 shadow-[8px_8px_0_#374151] p-6">
                <div className="grid grid-cols-2 gap-4">
                  {SAMPLE_IMAGES.map((imageUrl, index) => (
                    <button
                      key={index}
                      className={`relative border-4 border-gray-600 shadow-[4px_4px_0_#374151] overflow-hidden transition-all ${
                        selectedImage === index 
                          ? 'border-blue-600 shadow-[2px_2px_0_#1e3a8a] translate-x-[2px] translate-y-[2px]' 
                          : selectedImage !== null 
                            ? 'opacity-50' 
                            : 'hover:border-blue-400 hover:shadow-[2px_2px_0_#374151] hover:translate-x-[2px] hover:translate-y-[2px]'
                      }`}
                      onClick={() => handleImageSelect(index)}
                      disabled={selectedImage !== null}
                    >
                      <img
                        src={imageUrl}
                        alt={`Option ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                      {selectedImage === index && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="bg-blue-600 border-2 border-blue-800 shadow-[2px_2px_0_#1e3a8a] p-2">
                            <Check className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute top-2 left-2 bg-gray-800 border-2 border-gray-600 shadow-[1px_1px_0_#374151] px-2 py-1">
                        <div className="font-silkscreen text-xs font-bold text-white uppercase">
                          {index + 1}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback */}
              {showFeedback && (
                <div className="bg-white border-4 border-gray-800 shadow-[8px_8px_0_#374151] p-6 text-center">
                  <div className="bg-green-100 border-2 border-green-600 shadow-[2px_2px_0_#14532d] p-4">
                    <div className="font-silkscreen text-sm font-bold text-green-800 uppercase mb-2">
                      +{Math.floor(Math.random() * 20) + 10} POINTS!
                    </div>
                    <div className="font-silkscreen text-xs text-green-700 uppercase">
                      THANKS FOR HELPING IMPROVE IMAGE QUALITY DETECTION!
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <Toaster />
    </main>
  );
} 