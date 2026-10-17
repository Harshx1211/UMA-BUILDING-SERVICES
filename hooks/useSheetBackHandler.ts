// While a bottom sheet is open, Android's Back button closes the sheet
// instead of leaving the whole screen underneath it (found testing
// on-device: Back with the Site notebook open dropped you off the job).
// @gorhom/bottom-sheet doesn't do this on its own.
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export function useSheetBackHandler(isOpen: boolean, close: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);
}
