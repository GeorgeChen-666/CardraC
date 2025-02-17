import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  CircularProgressLabel,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Step,
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  Stepper,
  StepSeparator,
  StepStatus,
  StepTitle,
  useDisclosure,
  useSteps,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { checkImage, getImagePath, reloadLocalImage } from '../../../functions';
import { Actions, store } from '../../../store';
import { AiOutlineFileSearch } from 'react-icons/all';
import { Grid } from 'react-spreadsheet-grid';
import './style.css';
import { useDispatch } from 'react-redux';


export const ReloadDialog = forwardRef(({}, ref) => {
  const { t } = useTranslation();
  const [reloadProgress, setReloadProgress] = useState(0);
  const dispatch = useDispatch();
  const { isOpen, onOpen, onClose } = useDisclosure();
  useImperativeHandle(ref, () => ({
    openDialog: onOpen,
  }));
  const [newImagePath, setNewImagePath] = useState({});
  const [invalidImages, setInvalidImages] = useState([]);
  const steps = useMemo(()=> [
    { title: t('configDialog.reloadImageTitle1'), description: t('configDialog.reloadImageSubTitle1') },
    { title: t('configDialog.reloadImageTitle2'), description: t('configDialog.reloadImageSubTitle2') },
    { title: t('configDialog.reloadImageTitle3'), description: t('configDialog.reloadImageSubTitle3') },
  ], [t]);
  const { activeStep, goToNext, setActiveStep } = useSteps({
    index: 2,
    count: steps.length,
  });
  useEffect(() => {
    if(isOpen) {
      (async () => {
        setActiveStep(()=> 0)
        setReloadProgress(0);
        setInvalidImages([])
        const pathList = [];
        const { Config, CardList } = store.getState().pnp;
        Config.globalBackground?.path && pathList.push(Config.globalBackground?.path);
        CardList.forEach((card, index) => {
          card.face?.path && pathList.push(card.face?.path);
          card.back?.path && pathList.push(card.back?.path);
        });

        const result = await checkImage({ pathList });
        if((result || []).length > 0) {
          setInvalidImages(result);
        }
        goToNext();
      })();
    }
  }, [isOpen]);


  const dataList = useMemo(() => invalidImages.map(p => ({
    path: p,
    newPath: newImagePath[p]
  })), [newImagePath, invalidImages])
  return (<div>
    <Modal closeOnOverlayClick={false} isOpen={isOpen} onClose={onClose} size={'5xl'} isCentered scrollBehavior={'inside'}>
      <ModalOverlay />
      <ModalContent minWidth={'870px'} height={'600px'}>
        <ModalHeader padding={4}>
          {t('configDialog.reloadImageWizard')}
          <Stepper index={activeStep}>
            {steps.map((step, index) => (
              <Step key={index}>
                <StepIndicator>
                  <StepStatus
                    complete={<StepIcon />}
                    incomplete={<StepNumber />}
                    active={<StepNumber />}
                  />
                </StepIndicator>
                <Box flexShrink='0'>
                  <StepTitle>{step.title}</StepTitle>
                  <StepDescription>{step.description}</StepDescription>
                </Box>
                <StepSeparator />
              </Step>
            ))}
          </Stepper>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {activeStep < 2 && (<Grid
            focusOnSingleClick={true}
            placeholder={t('util.noData')}
            columns={[
              {
                title: () => t('configDialog.reloadImageTableColumn1'), value: (row) => row.path
              }, {
                title: () => t('configDialog.reloadImageTableColumn2'), value: (row) => row.newPath,
              },
              {
                title: () => t('configDialog.reloadImageTableColumn3'), getCellClassName: () => 'SpreadsheetGrid__cell_focused opCol', value: (row) => {
                  const path = row.path;
                  const getFileName = path => new URL(path).pathname.split('/').pop()
                  return(<IconButton
                    colorScheme='blue'
                    aria-label='Search database'
                    icon={<AiOutlineFileSearch />}
                    onClick={async () => {
                      const newPath = await getImagePath();
                      setNewImagePath(last => ({...last, [path]: newPath}));
                      const pathFileName = getFileName(path);
                      if(pathFileName === getFileName(newPath)) {
                        const replaceFrom = path.replace(pathFileName, '');
                        const replaceTo = newPath.replace(pathFileName, '');
                        const emptyInvalidImages = invalidImages.filter(p => !Object.keys(newImagePath).includes(p));
                        const newPathList = emptyInvalidImages.map(p => p.replace(replaceFrom, replaceTo));
                        const result = await checkImage({ pathList: newPathList });
                        newPathList.forEach((p, index) => {
                          if(!result.includes(p)) {
                            setNewImagePath(last => ({...last, [emptyInvalidImages[index]]: p}));
                          }
                        })
                      }
                    }}
                  />)
                },
              }
            ]}
            rows={dataList}
            getRowKey={row => row.id}
          />)}
          {activeStep === 2 && (<div className={'ProgressDiv'}>
            <CircularProgress value={reloadProgress * 100} size='320px'>
              <CircularProgressLabel>
                {`${parseInt(reloadProgress * 100)}%`}
              </CircularProgressLabel>
            </CircularProgress>
            <div>{reloadProgress === 1 && (<h2>{t('configDialog.reloadImageFinish')}</h2>)}</div>
          </div>)}
        </ModalBody>

        <ModalFooter>
          {activeStep < 2 && (<Button variant='ghost' onClick={async () => {
            goToNext();
            const state = JSON.parse(JSON.stringify(store.getState().pnp));
            const getNewPath = image => {
              if(image && image.path && newImagePath[image.path]) {
                image.path = newImagePath[image.path];
                delete image.mtime;
              }
            }
            getNewPath(state.Config.globalBackground);
            state.CardList.forEach((c, index) => {
              getNewPath(c.face);
              getNewPath(c.back)
            });
            const stateData = await reloadLocalImage({
              state,
              onProgress: setReloadProgress
            });
            if(stateData) {
              dispatch(Actions.StateFill(stateData));
              setReloadProgress(1);
            }
          }}>{t('button.next')}</Button>)}
          <Button variant='ghost' onClick={onClose}>{t('button.close')}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </div>);
});