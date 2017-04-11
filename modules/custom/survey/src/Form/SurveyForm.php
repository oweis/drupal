<?php
/**
* @file 
* Contains \Drupal\survey\Form\SurveyForm.
*/
namespace Drupal\survey\Form;

use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;
use \Drupal\node\Entity\Node;
use \Drupal\user\Entity\User;
use \Symfony\Component\HttpFoundation\RedirectResponse;

class SurveyForm extends FormBase {
  
  /**
   * {@inheritdoc}
   */
  public function getFormId() {
  	return 'survey_form';
  }

  /**
   * {@inheritdoc}
   */
  //TODO : Fix calculateResult 
  public function buildForm(array $form, FormStateInterface $form_state, $surveyId = NULL) {
  	if(!is_null($surveyId)){
  		//Saving the surveyId value to use it in submitForm
		$form_state->set('surveyId', $surveyId);

  		$survey = Node::load($surveyId);
  		$problems = $survey->field_problem->referencedEntities();

  		foreach($problems as $problem){
			//SET THE FORM TITLE AND TYPE
  			$form[$problem->nid->value] = array(
  			  '#type' => $problem->field_type->value,
  			  '#title' => $problem->field_question->value,
  			);
			
			//GET OPTIONS FOR MULTI OPTION QUESTIONS
  			if($problem->field_type->value == 'checkboxes'){
  				$options = array();
  				//$field_option = $problem->field_option_correct + $problem->field_option_incorrect;
				foreach ($problem->field_option_correct as $option) {
					$options[trim($option->value)] = trim($option->value);
				}
				foreach ($problem->field_option_incorrect as $option) {
					$options[trim($option->value)] = trim($option->value);
				}

				//randomizes the order of the elements 
				$form[$problem->nid->value]['#options'] = $this->shuffle_assoc($options);
			}	  
  		}

  		//add the submit button
  		$form['actions'] = array(
		  '#type' => 'actions',
		  'submit' => array(
	        '#type' => 'submit',
	        '#value' => $this->t('Enregistrer'),
	        '#button_type' => 'primary',
	      )
		);		
      return $form;
  	}
  }

  /**
   * {@inheritdoc}
   */
    public function validateForm(array &$form, FormStateInterface $form_state) {
      /*
       if(strlen($form_state->getValue('candidate_number')) < 10) {
        $form_state->setErrorByName('candidate_number', $this->t('Mobile number is too short.'));
      }
      */
    }

  /**
   * {@inheritdoc}
   */
	public function submitForm(array &$form, FormStateInterface $form_state) {

		//GET THE CURRENT USER
		$userId = \Drupal::currentUser()->id();
    	$user = User::load($userId);

    	//GET THE CURRENT SURVEY
    	$surveyId = $form_state->get('surveyId');
    	$survey = Node::load($surveyId);

    	//Removes internal elements and buttons
    	$form_state->cleanValues();

     	//CHECK IF THE USER HAS ALREADY FILL THE SURVEY
		if(!$this->isUserHaveSubmission($userId, $surveyId)){
	    	$answers = array();
			foreach ($form_state->getValues() as $key => $value) {

				$problem = Node::load($key);

				//result(field_result) : 
					//-1 => Question simple
					// 0 => Question with options : incorrect
					// 1 => Question with options : correct
				$result = -1;		
				$responses = $value;
				
				if(is_array($value)){
					$responses = array();				
					foreach ($value as $innerKey => $innerValue) {
						$responses[] = $innerValue;
					}
					foreach ($problem->field_option_correct as $item) {
						$correctResponses[] = $item->value;
					}
					//TODO : FIX THE CALCUL PROBLEM
					//$result = $this->calculateResult($correctResponses, $responses);
					
				}
			  	$answers[] = $this->createAnswer($problem, $responses, $result);
	    	}
	    	$this->createSubmission($survey, $user, $answers);
    	
	    	//REDIRECT TO THANK YOU PAGE
			$response = new RedirectResponse('/survey/thanks');
			$response->send(); // don't send the response yourself inside controller and form.
			return;
		}
		else{
			//REDIRECT TO SORRY PAGE
			$response = new RedirectResponse('/survey/sorry');
			$response->send(); // don't send the response yourself inside controller and form.
			return;	
		}
	}

	public function isUserHaveSubmission($userId, $surveyId){
		$nids = \Drupal::entityQuery('node')
			->condition('type', "submission")
			->condition('field_user', $userId)
			->condition('field_survey', $surveyId)
			->execute();
		$submissions = Node::loadMultiple($nids);
		return !empty($submissions);
	}

	public function createAnswer($problem, $response, $result = -1){
		// Create node object type : answer
		$node = Node::create([
			'type' => 'answer',
			'title' => 'Answer',
			'field_problem' => $problem,
			'field_response' => $response,
			'field_result' => $result,
			]);
		$node->save();
		return $node;
	}

	public function createSubmission($survey, $user, $answer){
		// Create node object type : submission
		$node = Node::create([
		  'type'        => 'submission',
		  'title'       => 'Submission',
		  'field_survey' => $survey,
  		  'field_user' => $user,
		  'field_answer' => $answer,
		  ]);
		$node->save();
	}

	public function calculateResult($correctResponse, $userResponse){
		$result = 1;
		$userOptions = array();
		foreach ($userResponse as $key => $value) {
			if($value != 0){
				$userOptions[] = $value; 
			}
		}
		
		$correctOptions = array();
		foreach ($correctResponse as $key => $value) {
			if($value != 0){
				$correctOptions[] = $value; 
			}
		}

		sort( $userOptions ); 
    	sort( $correctOptions );
		//$userResponse = $this->minifyArray($options);
		//$correctResponse = $this->minifyArray($correctResponse);
		if($userOptions ==  $correctOptions){
			$result = 0;
		}
		return $result;
	}

	public function shuffle_assoc($list) { 
		if(!is_array($list)) return $list; 

		$keys = array_keys($list); 
		shuffle($keys); 
		$random = array(); 
		foreach ($keys as $key) { 
			$random[$key] = $list[$key]; 
		}
		return $random; 
	} 
}